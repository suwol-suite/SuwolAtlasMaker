import { SuwolAtlasError } from "../../shared/errors.js";
import type { SpriteContent } from "../image/types.js";
import type { PackedSprite, Packer, PackOptions, PackPage, PackResult } from "./types.js";

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PageState {
  index: number;
  freeRects: Rect[];
  sprites: PackedSprite[];
  usedWidth: number;
  usedHeight: number;
}

interface PlacementCandidate {
  page: PageState;
  x: number;
  y: number;
  drawW: number;
  drawH: number;
  occupiedW: number;
  occupiedH: number;
  rotated: boolean;
  scoreShortSide: number;
  scoreLongSide: number;
  scoreArea: number;
}

export function packSprites(images: SpriteContent[], options: PackOptions): PackResult {
  validatePackOptions(options);

  const sorted = [...images].sort((a, b) => {
    const metadataOrder = compareMetadataOrder(a, b);

    if (metadataOrder !== null) {
      return metadataOrder;
    }

    const areaDiff = drawArea(b, options.extrude) - drawArea(a, options.extrude);
    if (areaDiff !== 0) {
      return areaDiff;
    }

    const maxSideDiff = Math.max(baseDrawWidth(b, options.extrude), baseDrawHeight(b, options.extrude)) -
      Math.max(baseDrawWidth(a, options.extrude), baseDrawHeight(a, options.extrude));
    if (maxSideDiff !== 0) {
      return maxSideDiff;
    }

    return a.name.localeCompare(b.name);
  });

  const pages: PageState[] = [createPageState(0, options.maxSize)];
  const sprites: PackedSprite[] = [];
  const logs = [
    `Packing ${images.length} sprite(s).`,
    "Algorithm: maxrects.",
    "Heuristic: BestShortSideFit.",
    `Max atlas size: ${options.maxSize}x${options.maxSize}.`,
    `Padding: ${options.padding}px.`,
    `Extrude: ${options.extrude}px.`,
    `Rotate: ${options.rotate ? "enabled" : "disabled"}.`
  ];

  for (const image of sorted) {
    assertImageCanFit(image, options);

    let placement = findBestPlacement(image, options, pages);

    if (!placement) {
      const nextPage = createPageState(pages.length, options.maxSize);
      pages.push(nextPage);
      placement = findBestPlacement(image, options, [nextPage]);

      if (!placement) {
        throw new SuwolAtlasError(
          `Image "${image.name}" cannot fit into a new atlas page (${options.maxSize}x${options.maxSize}) after trim/extrude.`,
          {
            code: "IMAGE_CANNOT_FIT_NEW_PAGE",
            filePath: image.filePath
          }
        );
      }
    }

    const sprite = createPackedSprite(image, options, placement);
    applyPlacement(placement.page, placement);
    placement.page.sprites.push(sprite);
    sprites.push(sprite);
    placement.page.usedWidth = Math.max(placement.page.usedWidth, sprite.drawX + sprite.drawW);
    placement.page.usedHeight = Math.max(placement.page.usedHeight, sprite.drawY + sprite.drawH);
  }

  const packedPages: PackPage[] = pages
    .filter((page) => page.sprites.length > 0)
    .map((page) => ({
      index: page.index,
      rawWidth: page.usedWidth,
      rawHeight: page.usedHeight,
      width: page.usedWidth,
      height: page.usedHeight,
      sprites: page.sprites
    }));

  logs.push(`Packed ${sprites.length} sprite(s) into ${packedPages.length} page(s).`);

  for (const page of packedPages) {
    logs.push(`Page ${page.index} size: ${page.width}x${page.height}; sprites: ${page.sprites.length}.`);
  }

  return {
    algorithm: "maxrects",
    pages: packedPages,
    sprites,
    logs,
    warnings: []
  };
}

function compareMetadataOrder(a: SpriteContent, b: SpriteContent): number | null {
  const aOrder = a.metadata?.order;
  const bOrder = b.metadata?.order;

  if (aOrder !== undefined && bOrder !== undefined) {
    return aOrder - bOrder || (a.metadata?.sourcePath ?? a.name).localeCompare(b.metadata?.sourcePath ?? b.name);
  }

  if (aOrder !== undefined) {
    return -1;
  }

  if (bOrder !== undefined) {
    return 1;
  }

  return null;
}

export const maxRectsPacker: Packer = {
  pack: packSprites
};

function createPageState(index: number, maxSize: number): PageState {
  return {
    index,
    freeRects: [{ x: 0, y: 0, width: maxSize, height: maxSize }],
    sprites: [],
    usedWidth: 0,
    usedHeight: 0
  };
}

function validatePackOptions(options: PackOptions): void {
  if (!Number.isInteger(options.maxSize) || options.maxSize <= 0) {
    throw new SuwolAtlasError("--max-size must be a positive integer.", {
      code: "INVALID_MAX_SIZE"
    });
  }

  if (!Number.isInteger(options.padding) || options.padding < 0) {
    throw new SuwolAtlasError("--padding must be a non-negative integer.", {
      code: "INVALID_PADDING"
    });
  }

  if (!Number.isInteger(options.extrude) || options.extrude < 0) {
    throw new SuwolAtlasError("--extrude must be a non-negative integer.", {
      code: "INVALID_EXTRUDE"
    });
  }
}

function findBestPlacement(
  image: SpriteContent,
  options: PackOptions,
  pages: PageState[]
): PlacementCandidate | null {
  const candidates: PlacementCandidate[] = [];

  for (const page of pages) {
    for (const freeRect of page.freeRects) {
      for (const orientation of orientationCandidates(image, options)) {
        if (orientation.drawW > freeRect.width || orientation.drawH > freeRect.height) {
          continue;
        }

        const occupiedW = getOccupiedSize(freeRect.x, orientation.drawW, options);
        const occupiedH = getOccupiedSize(freeRect.y, orientation.drawH, options);

        if (occupiedW > freeRect.width || occupiedH > freeRect.height) {
          continue;
        }

        const leftoverHoriz = freeRect.width - occupiedW;
        const leftoverVert = freeRect.height - occupiedH;
        candidates.push({
          page,
          x: freeRect.x,
          y: freeRect.y,
          drawW: orientation.drawW,
          drawH: orientation.drawH,
          occupiedW,
          occupiedH,
          rotated: orientation.rotated,
          scoreShortSide: Math.min(leftoverHoriz, leftoverVert),
          scoreLongSide: Math.max(leftoverHoriz, leftoverVert),
          scoreArea: freeRect.width * freeRect.height - occupiedW * occupiedH
        });
      }
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  return candidates.sort(comparePlacementCandidates)[0];
}

function getOccupiedSize(start: number, drawSize: number, options: PackOptions): number {
  return Math.min(drawSize + options.padding, options.maxSize - start);
}

function comparePlacementCandidates(a: PlacementCandidate, b: PlacementCandidate): number {
  const shortSideDiff = a.scoreShortSide - b.scoreShortSide;
  if (shortSideDiff !== 0) {
    return shortSideDiff;
  }

  const longSideDiff = a.scoreLongSide - b.scoreLongSide;
  if (longSideDiff !== 0) {
    return longSideDiff;
  }

  const areaDiff = a.scoreArea - b.scoreArea;
  if (areaDiff !== 0) {
    return areaDiff;
  }

  const pageDiff = a.page.index - b.page.index;
  if (pageDiff !== 0) {
    return pageDiff;
  }

  const yDiff = a.y - b.y;
  if (yDiff !== 0) {
    return yDiff;
  }

  const xDiff = a.x - b.x;
  if (xDiff !== 0) {
    return xDiff;
  }

  return Number(a.rotated) - Number(b.rotated);
}

function applyPlacement(page: PageState, placement: PlacementCandidate): void {
  const occupied = {
    x: placement.x,
    y: placement.y,
    width: placement.occupiedW,
    height: placement.occupiedH
  };
  const nextFreeRects: Rect[] = [];

  for (const freeRect of page.freeRects) {
    if (!intersects(freeRect, occupied)) {
      nextFreeRects.push(freeRect);
      continue;
    }

    nextFreeRects.push(...splitFreeRect(freeRect, occupied));
  }

  page.freeRects = pruneFreeRects(nextFreeRects);
}

function splitFreeRect(freeRect: Rect, usedRect: Rect): Rect[] {
  const result: Rect[] = [];
  const freeRight = freeRect.x + freeRect.width;
  const freeBottom = freeRect.y + freeRect.height;
  const usedRight = usedRect.x + usedRect.width;
  const usedBottom = usedRect.y + usedRect.height;

  if (usedRect.x > freeRect.x) {
    result.push({
      x: freeRect.x,
      y: freeRect.y,
      width: usedRect.x - freeRect.x,
      height: freeRect.height
    });
  }

  if (usedRight < freeRight) {
    result.push({
      x: usedRight,
      y: freeRect.y,
      width: freeRight - usedRight,
      height: freeRect.height
    });
  }

  if (usedRect.y > freeRect.y) {
    result.push({
      x: freeRect.x,
      y: freeRect.y,
      width: freeRect.width,
      height: usedRect.y - freeRect.y
    });
  }

  if (usedBottom < freeBottom) {
    result.push({
      x: freeRect.x,
      y: usedBottom,
      width: freeRect.width,
      height: freeBottom - usedBottom
    });
  }

  return result.filter((rect) => rect.width > 0 && rect.height > 0);
}

function pruneFreeRects(rects: Rect[]): Rect[] {
  const pruned: Rect[] = [];

  for (let i = 0; i < rects.length; i += 1) {
    const rect = rects[i];
    let contained = false;

    for (let j = 0; j < rects.length; j += 1) {
      if (i !== j && contains(rects[j], rect)) {
        contained = true;
        break;
      }
    }

    if (!contained && !pruned.some((existing) => sameRect(existing, rect))) {
      pruned.push(rect);
    }
  }

  return pruned.sort((a, b) => a.y - b.y || a.x - b.x || a.width - b.width || a.height - b.height);
}

function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y;
}

function contains(outer: Rect, inner: Rect): boolean {
  return inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height;
}

function sameRect(a: Rect, b: Rect): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

function createPackedSprite(
  image: SpriteContent,
  options: PackOptions,
  placement: PlacementCandidate
): PackedSprite {
  const drawX = placement.x;
  const drawY = placement.y;
  const spriteX = drawX + options.extrude;
  const spriteY = drawY + options.extrude;
  const spriteW = placement.rotated ? image.contentH : image.contentW;
  const spriteH = placement.rotated ? image.contentW : image.contentH;

  return {
    name: image.name,
    filePath: image.filePath,
    page: placement.page.index,
    x: spriteX,
    y: spriteY,
    w: spriteW,
    h: spriteH,
    spriteX,
    spriteY,
    spriteW,
    spriteH,
    drawX,
    drawY,
    drawW: placement.drawW,
    drawH: placement.drawH,
    rotated: placement.rotated,
    sourceW: image.sourceW,
    sourceH: image.sourceH,
    contentW: image.contentW,
    contentH: image.contentH,
    offsetX: image.offsetX,
    offsetY: image.offsetY,
    trimmed: image.trimmed,
    extrude: options.extrude,
    image,
    metadata: image.metadata
  };
}

function orientationCandidates(
  image: SpriteContent,
  options: PackOptions
): Array<{ rotated: boolean; drawW: number; drawH: number }> {
  const drawW = baseDrawWidth(image, options.extrude);
  const drawH = baseDrawHeight(image, options.extrude);
  const candidates = [
    {
      rotated: false,
      drawW,
      drawH
    }
  ];

  if (options.rotate && drawW !== drawH) {
    candidates.push({
      rotated: true,
      drawW: drawH,
      drawH: drawW
    });
  }

  return candidates;
}

function assertImageCanFit(image: SpriteContent, options: PackOptions): void {
  const natural = {
    width: baseDrawWidth(image, options.extrude),
    height: baseDrawHeight(image, options.extrude)
  };
  const rotated = {
    width: natural.height,
    height: natural.width
  };
  const naturalFits = natural.width <= options.maxSize && natural.height <= options.maxSize;
  const rotatedFits =
    options.rotate && rotated.width <= options.maxSize && rotated.height <= options.maxSize;

  if (!naturalFits && !rotatedFits) {
    throw new SuwolAtlasError(
      `Image "${image.name}" exceeds max size ${options.maxSize}x${options.maxSize} after trim/extrude: ${natural.width}x${natural.height}.`,
      {
        code: "IMAGE_EXCEEDS_MAX_SIZE",
        filePath: image.filePath
      }
    );
  }
}

function drawArea(image: SpriteContent, extrude: number): number {
  return baseDrawWidth(image, extrude) * baseDrawHeight(image, extrude);
}

function baseDrawWidth(image: SpriteContent, extrude: number): number {
  return image.contentW + extrude * 2;
}

function baseDrawHeight(image: SpriteContent, extrude: number): number {
  return image.contentH + extrude * 2;
}
