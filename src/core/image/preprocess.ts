import { PNG } from "pngjs";
import { SuwolAtlasError } from "../../shared/errors.js";
import type { LoadedImage, PrepareImageOptions, SpriteContent } from "./types.js";
import type { SpriteCropRect } from "../metadata/metadataTypes.js";

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function prepareImages(
  images: LoadedImage[],
  options: PrepareImageOptions
): SpriteContent[] {
  return images.map((image) => prepareImage(image, options));
}

export function prepareImage(
  image: LoadedImage,
  options: PrepareImageOptions
): SpriteContent {
  const trimMode = image.metadata?.trimMode ?? "default";

  if (trimMode === "manual") {
    return prepareManualCrop(image);
  }

  const shouldTrim = trimMode === "auto" || (trimMode === "default" && options.trim);

  if (!shouldTrim) {
    return {
      name: image.name,
      filePath: image.filePath,
      sourceW: image.width,
      sourceH: image.height,
      contentW: image.width,
      contentH: image.height,
      offsetX: 0,
      offsetY: 0,
      trimmed: false,
      png: image.png,
      metadata: image.metadata
    };
  }

  const bounds = findVisibleBounds(image.png);

  if (!bounds) {
    return {
      name: image.name,
      filePath: image.filePath,
      sourceW: image.width,
      sourceH: image.height,
      contentW: 1,
      contentH: 1,
      offsetX: 0,
      offsetY: 0,
      trimmed: true,
      png: new PNG({ width: 1, height: 1 }),
      metadata: image.metadata
    };
  }

  const contentW = bounds.maxX - bounds.minX + 1;
  const contentH = bounds.maxY - bounds.minY + 1;

  return {
    name: image.name,
    filePath: image.filePath,
    sourceW: image.width,
    sourceH: image.height,
    contentW,
    contentH,
    offsetX: bounds.minX,
    offsetY: bounds.minY,
    trimmed:
      bounds.minX !== 0 ||
      bounds.minY !== 0 ||
      contentW !== image.width ||
      contentH !== image.height,
    png: cropPng(image.png, bounds.minX, bounds.minY, contentW, contentH),
    metadata: image.metadata
  };
}

export function findAutoTrimCrop(png: PNG): SpriteCropRect | null {
  const bounds = findVisibleBounds(png);

  if (!bounds) {
    return null;
  }

  return {
    x: bounds.minX,
    y: bounds.minY,
    w: bounds.maxX - bounds.minX + 1,
    h: bounds.maxY - bounds.minY + 1
  };
}

export function findVisibleBounds(png: PNG): Bounds | null {
  let minX = png.width;
  let minY = png.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const alpha = png.data[(y * png.width + x) * 4 + 3];

      if (alpha > 0) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < 0 || maxY < 0) {
    return null;
  }

  return { minX, minY, maxX, maxY };
}

export function cropPng(source: PNG, x: number, y: number, width: number, height: number): PNG {
  const target = new PNG({ width, height });

  for (let row = 0; row < height; row += 1) {
    const sourceStart = ((y + row) * source.width + x) * 4;
    const sourceEnd = sourceStart + width * 4;
    const targetStart = row * width * 4;
    source.data.copy(target.data, targetStart, sourceStart, sourceEnd);
  }

  return target;
}

function prepareManualCrop(image: LoadedImage): SpriteContent {
  const crop = image.metadata?.crop;

  if (!crop) {
    throw new SuwolAtlasError(`Manual trimMode requires a crop rect for "${image.name}".`, {
      code: "INVALID_METADATA_CROP",
      filePath: image.filePath
    });
  }

  return {
    name: image.name,
    filePath: image.filePath,
    sourceW: image.width,
    sourceH: image.height,
    contentW: crop.w,
    contentH: crop.h,
    offsetX: crop.x,
    offsetY: crop.y,
    trimmed: true,
    png: cropPng(image.png, crop.x, crop.y, crop.w, crop.h),
    metadata: image.metadata
  };
}
