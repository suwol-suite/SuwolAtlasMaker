import path from "node:path";
import { SuwolAtlasError } from "../../shared/errors.js";
import { withoutExtension } from "../../shared/paths.js";
import type { LoadedImage } from "../image/types.js";
import type { AppliedSpriteMetadata, MetadataStats, SpriteMetadataMap } from "./metadataTypes.js";
import { normalizeMetadataPathKey, validateAndResolveSpriteMetadata } from "./spriteMetadata.js";

export interface MetadataResolveResult {
  images: LoadedImage[];
  stats: MetadataStats;
  warnings: string[];
}

export function resolveSpriteMetadata(
  images: LoadedImage[],
  inputDir: string,
  spriteMetadata: SpriteMetadataMap | undefined
): MetadataResolveResult {
  const metadata = spriteMetadata ?? {};
  const metadataKeys = new Set(Object.keys(metadata).map(normalizeMetadataPathKey));
  const seenNames = new Map<string, string>();
  const resolvedImages: LoadedImage[] = [];
  const warnings: string[] = [];
  let excludedSprites = 0;
  let renamedSprites = 0;
  let pivotOverrideSprites = 0;
  let taggedSprites = 0;
  let groupedSprites = 0;
  let orderedSprites = 0;
  let trimModeOverrideSprites = 0;
  let manualCropSprites = 0;
  const included: Array<{ image: LoadedImage; sourcePath: string; order?: number; originalIndex: number }> = [];

  for (let index = 0; index < images.length; index += 1) {
    const image = images[index];
    const sourcePath = normalizeMetadataPathKey(path.relative(inputDir, image.filePath));
    const entry = metadata[sourcePath];
    metadataKeys.delete(sourcePath);

    const resolved = validateAndResolveSpriteMetadata(entry, sourcePath, image.width, image.height);
    const originalName = withoutExtension(image.filePath);
    const exportName = resolved.nameOverride ?? originalName;
    const hasMetadata = entry !== undefined;
    const nameOverridden = resolved.nameOverride !== undefined && resolved.nameOverride !== originalName;
    const pivotOverridden = hasMetadata &&
      (entry?.pivotX !== undefined || entry?.pivotY !== undefined) &&
      (resolved.pivotX !== 0.5 || resolved.pivotY !== 0.5);
    const orderOverridden = resolved.order !== undefined;
    const trimModeOverridden = resolved.trimMode !== "default";
    const manualCrop = resolved.trimMode === "manual" && resolved.crop !== undefined;

    if (!resolved.include) {
      excludedSprites += 1;
      continue;
    }

    const duplicate = seenNames.get(exportName);

    if (duplicate) {
      throw new SuwolAtlasError(
        `Duplicate export sprite name "${exportName}". First source: ${duplicate}. Duplicate source: ${sourcePath}.`,
        {
          code: "DUPLICATE_EXPORT_SPRITE_NAME",
          filePath: image.filePath
        }
      );
    }

    const appliedMetadata: AppliedSpriteMetadata = {
      ...resolved,
      sourcePath,
      originalName,
      exportName,
      hasMetadata,
      nameOverridden,
      pivotOverridden,
      orderOverridden,
      trimModeOverridden,
      manualCrop
    };

    seenNames.set(exportName, sourcePath);
    included.push({
      sourcePath,
      order: resolved.order,
      originalIndex: index,
      image: {
        ...image,
        name: exportName,
        metadata: appliedMetadata
      }
    });

    if (nameOverridden) {
      renamedSprites += 1;
    }

    if (pivotOverridden) {
      pivotOverrideSprites += 1;
    }

    if (orderOverridden) {
      orderedSprites += 1;
    }

    if (trimModeOverridden) {
      trimModeOverrideSprites += 1;
    }

    if (manualCrop) {
      manualCropSprites += 1;
    }

    if (resolved.tags.length > 0) {
      taggedSprites += 1;
    }

    if (resolved.group) {
      groupedSprites += 1;
    }
  }

  included.sort(compareIncludedImages);

  for (const item of included) {
    resolvedImages.push(item.image);
  }

  for (const unusedKey of metadataKeys) {
    warnings.push(`Sprite metadata key did not match an input PNG and was ignored: ${unusedKey}`);
  }

  if (resolvedImages.length === 0) {
    throw new SuwolAtlasError("No sprites are included for export after applying sprite metadata.", {
      code: "NO_INCLUDED_SPRITES"
    });
  }

  return {
    images: resolvedImages,
    warnings,
    stats: {
      enabled: Object.keys(metadata).length > 0,
      totalInputSprites: images.length,
      includedSprites: resolvedImages.length,
      excludedSprites,
      renamedSprites,
      pivotOverrideSprites,
      taggedSprites,
      groupedSprites,
      orderedSprites,
      trimModeOverrideSprites,
      manualCropSprites,
      sidecarPath: null
    }
  };
}

function compareIncludedImages(
  a: { sourcePath: string; order?: number; originalIndex: number },
  b: { sourcePath: string; order?: number; originalIndex: number }
): number {
  if (a.order !== undefined && b.order !== undefined) {
    return a.order - b.order || a.sourcePath.localeCompare(b.sourcePath);
  }

  if (a.order !== undefined) {
    return -1;
  }

  if (b.order !== undefined) {
    return 1;
  }

  return a.originalIndex - b.originalIndex;
}
