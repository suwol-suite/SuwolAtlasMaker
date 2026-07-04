import { promises as fs } from "node:fs";
import path from "node:path";
import type { MetadataSidecarJson } from "../metadata/metadataTypes.js";
import type { PackResult } from "../packer/types.js";

export function buildMetadataSidecarJson(name: string, packResult: PackResult): MetadataSidecarJson {
  return {
    version: 1,
    atlas: name,
    sprites: packResult.sprites.map((sprite) => {
      const metadata = sprite.metadata;

      return {
        name: sprite.name,
        sourcePath: metadata?.sourcePath ?? sprite.filePath.replace(/\\/g, "/"),
        originalName: metadata?.originalName ?? sprite.name,
        included: true,
        group: metadata?.group ?? "",
        tags: metadata?.tags ?? [],
        pivotX: metadata?.pivotX ?? 0.5,
        pivotY: metadata?.pivotY ?? 0.5,
        order: metadata?.order,
        trimMode: metadata?.trimMode ?? "default",
        crop: metadata?.trimMode === "manual" ? metadata.crop : undefined
      };
    })
  };
}

export async function writeMetadataSidecarJson(
  outputDir: string,
  name: string,
  packResult: PackResult
): Promise<string> {
  const outputPath = path.join(outputDir, `${name}.metadata.json`);
  const json = buildMetadataSidecarJson(name, packResult);
  await fs.writeFile(outputPath, `${JSON.stringify(json, null, 2)}\n`, "utf8");
  return outputPath;
}
