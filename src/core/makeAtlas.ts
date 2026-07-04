import { promises as fs } from "node:fs";
import path from "node:path";
import { loadPngImages } from "./image/pngLoader.js";
import { prepareImages } from "./image/preprocess.js";
import { writeAtlasJson } from "./exporters/jsonExporter.js";
import { writeMetadataSidecarJson } from "./exporters/metadataExporter.js";
import { writeAtlasPngs } from "./exporters/pngExporter.js";
import { writePackLog } from "./exporters/logExporter.js";
import { packSprites, parsePackingAlgorithm } from "./packer/packerFactory.js";
import { buildCacheEntries, compareCache, createOptionsHash, getCachePath, readCache, writeCache } from "./cache/cacheStore.js";
import { resolveSpriteMetadata } from "./metadata/metadataResolver.js";
import { hasSidecarMetadata, normalizeSpriteMetadataMap } from "./metadata/spriteMetadata.js";
import { SuwolAtlasError } from "../shared/errors.js";
import { assertSafeOutputName, isSameOrInside } from "../shared/paths.js";
import { DEFAULT_PACKING_ALGORITHM, type PackingAlgorithm } from "../shared/packing.js";
import { DEFAULT_SIZE_MODE, type SizeMode } from "../shared/sizeMode.js";
import { applySizeMode, parseSizeMode } from "./sizing/sizeMode.js";
import type { AtlasCacheStats } from "./cache/cacheTypes.js";
import type { MetadataStats, SpriteMetadataMap } from "./metadata/metadataTypes.js";

const TOOL_VERSION = "0.1.0";

export interface MakeAtlasOptions {
  name: string;
  maxSize: number;
  padding: number;
  format: "json";
  clean: boolean;
  trim?: boolean;
  extrude?: number;
  rotate?: boolean;
  algorithm?: PackingAlgorithm;
  sizeMode?: SizeMode;
  cache?: boolean;
  spriteMetadata?: SpriteMetadataMap;
  metadataSidecar?: boolean;
}

export interface MakeAtlasResult {
  spriteCount: number;
  files: {
    png: string;
    pngs: string[];
    json: string;
    log: string;
    metadata?: string;
  };
  warnings: string[];
  cache: AtlasCacheStats;
  metadata: MetadataStats;
}

export async function makeAtlas(
  inputDir: string,
  outputDir: string,
  options: MakeAtlasOptions
): Promise<MakeAtlasResult> {
  assertSafeOutputName(options.name);

  if (options.format !== "json") {
    throw new SuwolAtlasError(`Unsupported export format: ${options.format}`, {
      code: "UNSUPPORTED_FORMAT"
    });
  }

  const resolvedInputDir = path.resolve(inputDir);
  const resolvedOutputDir = path.resolve(outputDir);

  await assertDirectoryExists(resolvedInputDir);

  if (options.clean && isSameOrInside(resolvedOutputDir, resolvedInputDir)) {
    throw new SuwolAtlasError(
      "--clean refused because the output directory contains the input directory.",
      {
        code: "UNSAFE_CLEAN_PATH",
        filePath: resolvedOutputDir
      }
    );
  }

  const resolvedOptions = {
    trim: options.trim ?? false,
    extrude: options.extrude ?? 0,
    rotate: options.rotate ?? false,
    algorithm: options.algorithm === undefined
      ? DEFAULT_PACKING_ALGORITHM
      : parsePackingAlgorithm(options.algorithm),
    sizeMode: options.sizeMode === undefined
      ? DEFAULT_SIZE_MODE
      : parseSizeMode(options.sizeMode),
    cache: options.cache ?? false
  };

  validateOptions(resolvedOptions);

  const spriteMetadata = normalizeSpriteMetadataMap(options.spriteMetadata);
  const images = await loadPngImages(resolvedInputDir);
  const metadataResult = resolveSpriteMetadata(images, resolvedInputDir, spriteMetadata);
  const cachePath = getCachePath(resolvedOutputDir);
  const optionsHash = createOptionsHash({
    maxSize: options.maxSize,
    padding: options.padding,
    trim: resolvedOptions.trim,
    extrude: resolvedOptions.extrude,
    rotate: resolvedOptions.rotate,
    algorithm: resolvedOptions.algorithm,
    sizeMode: resolvedOptions.sizeMode,
    spriteMetadata
  });
  const cacheEntries = await buildCacheEntries(resolvedInputDir, images);
  const cacheRead = resolvedOptions.cache
    ? await readCache(cachePath)
    : { cache: null, invalidationReason: null };
  const cacheStats = compareCache(cacheRead.cache, cacheEntries, {
    enabled: resolvedOptions.cache,
    cachePath,
    inputDir: resolvedInputDir,
    optionsHash,
    toolVersion: TOOL_VERSION,
    readInvalidationReason: cacheRead.invalidationReason
  });
  const sprites = prepareImages(metadataResult.images, {
    trim: resolvedOptions.trim
  });
  const packed = packSprites(sprites, {
    maxSize: options.maxSize,
    padding: options.padding,
    extrude: resolvedOptions.extrude,
    rotate: resolvedOptions.rotate,
    algorithm: resolvedOptions.algorithm
  });
  packed.warnings.push(...metadataResult.warnings);
  const packResult = applySizeMode(packed, resolvedOptions.sizeMode, options.maxSize);

  await prepareOutputDirectory(resolvedOutputDir, options.clean, options.name);

  const pngs = await writeAtlasPngs(resolvedOutputDir, options.name, packResult);
  const json = await writeAtlasJson(resolvedOutputDir, options.name, packResult);
  const shouldWriteMetadata = options.metadataSidecar ?? hasSidecarMetadata(spriteMetadata);
  const metadata = shouldWriteMetadata
    ? await writeMetadataSidecarJson(resolvedOutputDir, options.name, packResult)
    : undefined;
  const metadataStats: MetadataStats = {
    ...metadataResult.stats,
    sidecarPath: metadata ?? null
  };
  const log = await writePackLog(resolvedOutputDir, options.name, packResult, {
    maxSize: options.maxSize,
    padding: options.padding,
    trim: resolvedOptions.trim,
    extrude: resolvedOptions.extrude,
    rotate: resolvedOptions.rotate,
    algorithm: resolvedOptions.algorithm,
    sizeMode: resolvedOptions.sizeMode,
    cache: cacheStats,
    metadata: metadataStats
  });

  if (resolvedOptions.cache) {
    await writeCache(cachePath, {
      toolVersion: TOOL_VERSION,
      inputDir: resolvedInputDir,
      optionsHash,
      files: cacheEntries
    });
  }

  return {
    spriteCount: packResult.sprites.length,
    files: {
      png: pngs[0],
      pngs,
      json,
      log,
      metadata
    },
    warnings: packResult.warnings,
    cache: cacheStats,
    metadata: metadataStats
  };
}

function validateOptions(options: { extrude: number }): void {
  if (!Number.isInteger(options.extrude) || options.extrude < 0) {
    throw new SuwolAtlasError("--extrude must be a non-negative integer.", {
      code: "INVALID_EXTRUDE"
    });
  }
}

async function assertDirectoryExists(dir: string): Promise<void> {
  try {
    const stat = await fs.stat(dir);

    if (!stat.isDirectory()) {
      throw new SuwolAtlasError(`Input path is not a directory: ${dir}`, {
        code: "INPUT_NOT_DIRECTORY",
        filePath: dir
      });
    }
  } catch (error) {
    if (error instanceof SuwolAtlasError) {
      throw error;
    }

    throw new SuwolAtlasError(`Input directory does not exist: ${dir}`, {
      code: "INPUT_DIRECTORY_MISSING",
      filePath: dir,
      cause: error
    });
  }
}

async function prepareOutputDirectory(outputDir: string, clean: boolean, name: string): Promise<void> {
  await fs.mkdir(outputDir, { recursive: true });

  if (clean) {
    await cleanGeneratedAtlasFiles(outputDir, name);
  }
}

async function cleanGeneratedAtlasFiles(outputDir: string, name: string): Promise<void> {
  const entries = await fs.readdir(outputDir, { withFileTypes: true });
  const pagePngPattern = new RegExp(`^${escapeRegExp(name)}_\\d+\\.png$`);
  const exactNames = new Set([`${name}.png`, `${name}.json`, `${name}.metadata.json`, `${name}.log.txt`]);

  await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .filter((entry) => exactNames.has(entry.name) || pagePngPattern.test(entry.name))
      .map((entry) => fs.rm(path.join(outputDir, entry.name), { force: true }))
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
