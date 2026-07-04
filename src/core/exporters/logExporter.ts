import { promises as fs } from "node:fs";
import path from "node:path";
import type { PackResult } from "../packer/types.js";
import { getAtlasPageImageName } from "./pageNaming.js";
import type { PackingAlgorithm } from "../../shared/packing.js";
import type { SizeMode } from "../../shared/sizeMode.js";
import type { AtlasCacheStats } from "../cache/cacheTypes.js";
import type { MetadataStats } from "../metadata/metadataTypes.js";

export interface PackLogOptions {
  maxSize: number;
  padding: number;
  trim: boolean;
  extrude: number;
  rotate: boolean;
  algorithm: PackingAlgorithm;
  sizeMode: SizeMode;
  cache: AtlasCacheStats;
  metadata?: MetadataStats;
}

export async function writePackLog(
  outputDir: string,
  name: string,
  packResult: PackResult,
  options: PackLogOptions
): Promise<string> {
  const outputPath = path.join(outputDir, `${name}.log.txt`);
  const totalUsedArea = sumUsedArea(packResult);
  const totalAtlasArea = sumAtlasArea(packResult);
  const rotatedCount = packResult.sprites.filter((sprite) => sprite.rotated).length;
  const trimmedCount = packResult.sprites.filter((sprite) => sprite.trimmed).length;
  const metadata = options.metadata;
  const lines = [
    "Suwol Atlas Maker packing log",
    `Atlas: ${name}`,
    `Algorithm: ${options.algorithm}`,
    `Size mode: ${options.sizeMode}`,
    `Sprites: ${packResult.sprites.length}`,
    `Pages: ${packResult.pages.length}`,
    `Multipack: ${packResult.pages.length > 1 ? "yes" : "no"}`,
    `Rotated sprites: ${rotatedCount}`,
    `Trimmed sprites: ${trimmedCount}`,
    `Total used area: ${totalUsedArea}`,
    `Total atlas area: ${totalAtlasArea}`,
    `Total occupancy: ${formatPercent(totalUsedArea, totalAtlasArea)}`,
    "",
    "Options:",
    `- algorithm: ${options.algorithm}`,
    `- size-mode: ${options.sizeMode}`,
    `- max-size: ${options.maxSize}`,
    `- padding: ${options.padding}`,
    `- trim: ${options.trim ? "enabled" : "disabled"}`,
    `- extrude: ${options.extrude}`,
    `- rotate: ${options.rotate ? "enabled" : "disabled"}`,
    `- cache: ${options.cache.enabled ? "enabled" : "disabled"}`,
    "",
    "Metadata:",
    `- enabled: ${metadata?.enabled ? "yes" : "no"}`,
    `- total input PNGs: ${metadata?.totalInputSprites ?? packResult.sprites.length}`,
    `- included sprites: ${metadata?.includedSprites ?? packResult.sprites.length}`,
    `- excluded sprites: ${metadata?.excludedSprites ?? 0}`,
    `- renamed sprites: ${metadata?.renamedSprites ?? 0}`,
    `- pivot overrides: ${metadata?.pivotOverrideSprites ?? 0}`,
    `- tagged sprites: ${metadata?.taggedSprites ?? 0}`,
    `- grouped sprites: ${metadata?.groupedSprites ?? 0}`,
    `- ordered sprites: ${metadata?.orderedSprites ?? 0}`,
    `- trim mode overrides: ${metadata?.trimModeOverrideSprites ?? 0}`,
    `- manual crops: ${metadata?.manualCropSprites ?? 0}`,
    `- sidecar: ${metadata?.sidecarPath ?? "none"}`,
    "",
    "Cache:",
    `- path: ${options.cache.cachePath}`,
    `- enabled: ${options.cache.enabled ? "yes" : "no"}`,
    `- hits: ${options.cache.hits}`,
    `- misses: ${options.cache.misses}`,
    `- invalidation: ${options.cache.invalidationReason ?? "none"}`,
    "",
    ...packResult.logs,
    "",
    "Pages:",
    ...packResult.pages.map((page) => {
      const image = getAtlasPageImageName(name, page.index, packResult.pages.length);
      const usedArea = sumPageUsedArea(page);
      const atlasArea = page.width * page.height;
      return `- page ${page.index}: ${image}, raw=${page.rawWidth}x${page.rawHeight}, final=${page.width}x${page.height}, sprites: ${page.sprites.length}, used area: ${usedArea}, atlas area: ${atlasArea}, occupancy: ${formatPercent(usedArea, atlasArea)}`;
    }),
    "",
    "Sprites:",
    ...packResult.sprites.map(
      (sprite) =>
        `- ${sprite.name}: page=${sprite.page}, x=${sprite.spriteX}, y=${sprite.spriteY}, w=${sprite.spriteW}, h=${sprite.spriteH}, draw=${sprite.drawX},${sprite.drawY},${sprite.drawW},${sprite.drawH}, rotated=${sprite.rotated}, trimmed=${sprite.trimmed}`
    ),
    "",
    packResult.warnings.length > 0 ? "Warnings:" : "Warnings: none",
    ...packResult.warnings.map((warning) => `- ${warning}`)
  ];

  await fs.writeFile(outputPath, `${lines.join("\n")}\n`, "utf8");
  return outputPath;
}

function sumUsedArea(packResult: PackResult): number {
  return packResult.pages.reduce((total, page) => total + sumPageUsedArea(page), 0);
}

function sumPageUsedArea(page: PackResult["pages"][number]): number {
  return page.sprites.reduce((total, sprite) => total + sprite.drawW * sprite.drawH, 0);
}

function sumAtlasArea(packResult: PackResult): number {
  return packResult.pages.reduce((total, page) => total + page.width * page.height, 0);
}

function formatPercent(usedArea: number, atlasArea: number): string {
  if (atlasArea <= 0) {
    return "0.00%";
  }

  return `${((usedArea / atlasArea) * 100).toFixed(2)}%`;
}
