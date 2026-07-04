import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { LoadedImage } from "../image/types.js";
import { CACHE_FILE_NAME, CACHE_FILE_VERSION, type AtlasCacheFile, type AtlasCacheFileEntry, type AtlasCacheStats } from "./cacheTypes.js";

export function getCachePath(outputDir: string): string {
  return path.join(outputDir, CACHE_FILE_NAME);
}

export function createOptionsHash(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

export async function buildCacheEntries(inputDir: string, images: LoadedImage[]): Promise<AtlasCacheFileEntry[]> {
  const resolvedInputDir = path.resolve(inputDir);
  const entries = await Promise.all(images.map(async (image) => {
    const stat = await fs.stat(image.filePath);
    const data = await fs.readFile(image.filePath);

    return {
      path: path.relative(resolvedInputDir, image.filePath).replace(/\\/g, "/"),
      size: stat.size,
      mtimeMs: stat.mtimeMs,
      hash: createHash("sha256").update(data).digest("hex"),
      width: image.width,
      height: image.height
    };
  }));

  return entries.sort((a, b) => a.path.localeCompare(b.path));
}

export async function readCache(cachePath: string): Promise<{ cache: AtlasCacheFile | null; invalidationReason: string | null }> {
  try {
    const parsed = JSON.parse(await fs.readFile(cachePath, "utf8")) as unknown;

    if (!isCacheFile(parsed)) {
      return {
        cache: null,
        invalidationReason: "cache file was invalid"
      };
    }

    return {
      cache: parsed,
      invalidationReason: null
    };
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return {
        cache: null,
        invalidationReason: "cache file was missing"
      };
    }

    return {
      cache: null,
      invalidationReason: "cache file could not be read"
    };
  }
}

export function compareCache(
  cache: AtlasCacheFile | null,
  current: AtlasCacheFileEntry[],
  options: {
    enabled: boolean;
    cachePath: string;
    inputDir: string;
    optionsHash: string;
    toolVersion: string;
    readInvalidationReason: string | null;
  }
): AtlasCacheStats {
  if (!options.enabled) {
    return {
      enabled: false,
      cachePath: options.cachePath,
      hits: 0,
      misses: 0,
      invalidationReason: null
    };
  }

  if (!cache) {
    return {
      enabled: true,
      cachePath: options.cachePath,
      hits: 0,
      misses: current.length,
      invalidationReason: options.readInvalidationReason ?? "cache file was missing"
    };
  }

  if (cache.toolVersion !== options.toolVersion) {
    return invalidated(options.cachePath, current.length, "tool version changed");
  }

  if (path.resolve(cache.inputDir) !== path.resolve(options.inputDir)) {
    return invalidated(options.cachePath, current.length, "input directory changed");
  }

  if (cache.optionsHash !== options.optionsHash) {
    return invalidated(options.cachePath, current.length, "options changed");
  }

  const previousByPath = new Map(cache.files.map((entry) => [entry.path, entry]));
  let hits = 0;
  let misses = 0;

  for (const entry of current) {
    const previous = previousByPath.get(entry.path);

    if (previous && sameEntry(previous, entry)) {
      hits += 1;
    } else {
      misses += 1;
    }
  }

  const removedCount = cache.files.filter((entry) => !current.some((item) => item.path === entry.path)).length;
  const invalidationReason = misses > 0 || removedCount > 0 ? "input files changed" : null;

  return {
    enabled: true,
    cachePath: options.cachePath,
    hits,
    misses,
    invalidationReason
  };
}

export async function writeCache(
  cachePath: string,
  cache: Omit<AtlasCacheFile, "version">
): Promise<void> {
  await fs.mkdir(path.dirname(cachePath), { recursive: true });
  await fs.writeFile(
    cachePath,
    `${JSON.stringify({ version: CACHE_FILE_VERSION, ...cache }, null, 2)}\n`,
    "utf8"
  );
}

function invalidated(cachePath: string, misses: number, reason: string): AtlasCacheStats {
  return {
    enabled: true,
    cachePath,
    hits: 0,
    misses,
    invalidationReason: reason
  };
}

function sameEntry(a: AtlasCacheFileEntry, b: AtlasCacheFileEntry): boolean {
  return a.size === b.size &&
    a.mtimeMs === b.mtimeMs &&
    a.hash === b.hash &&
    a.width === b.width &&
    a.height === b.height;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function isCacheFile(value: unknown): value is AtlasCacheFile {
  if (!value || typeof value !== "object") {
    return false;
  }

  const cache = value as Partial<AtlasCacheFile>;

  return cache.version === CACHE_FILE_VERSION &&
    typeof cache.toolVersion === "string" &&
    typeof cache.inputDir === "string" &&
    typeof cache.optionsHash === "string" &&
    Array.isArray(cache.files) &&
    cache.files.every(isCacheEntry);
}

function isCacheEntry(value: unknown): value is AtlasCacheFileEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const entry = value as Partial<AtlasCacheFileEntry>;

  return typeof entry.path === "string" &&
    typeof entry.size === "number" &&
    typeof entry.mtimeMs === "number" &&
    typeof entry.hash === "string" &&
    typeof entry.width === "number" &&
    typeof entry.height === "number";
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
