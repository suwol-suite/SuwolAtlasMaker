import { SuwolAtlasError } from "../../shared/errors.js";
import type { SpriteContent } from "../image/types.js";
import type { PackedSprite, Packer, PackOptions, PackPage, PackResult } from "./types.js";

interface PlacementCandidate {
  rotated: boolean;
  drawW: number;
  drawH: number;
  x: number;
  y: number;
  startsNewRow: boolean;
  resultingRowHeight: number;
}

interface PageState {
  index: number;
  sprites: PackedSprite[];
  cursorX: number;
  cursorY: number;
  rowHeight: number;
  usedWidth: number;
  usedHeight: number;
}

export function packSprites(images: SpriteContent[], options: PackOptions): PackResult {
  validatePackOptions(options);

  const sorted = [...images].sort((a, b) => {
    const metadataOrder = compareMetadataOrder(a, b);

    if (metadataOrder !== null) {
      return metadataOrder;
    }

    const heightDiff = baseDrawHeight(b, options.extrude) - baseDrawHeight(a, options.extrude);
    if (heightDiff !== 0) {
      return heightDiff;
    }

    const widthDiff = baseDrawWidth(b, options.extrude) - baseDrawWidth(a, options.extrude);
    if (widthDiff !== 0) {
      return widthDiff;
    }

    return a.name.localeCompare(b.name);
  });

  const pages: PageState[] = [createPageState(0)];
  const sprites: PackedSprite[] = [];
  const logs = [
    `Packing ${images.length} sprite(s).`,
    `Max atlas size: ${options.maxSize}x${options.maxSize}.`,
    `Padding: ${options.padding}px.`,
    `Extrude: ${options.extrude}px.`,
    `Rotate: ${options.rotate ? "enabled" : "disabled"}.`
  ];

  for (const image of sorted) {
    assertImageCanFit(image, options);

    let page = pages[pages.length - 1];
    let placement = choosePlacement(image, options, page.cursorX, page.cursorY, page.rowHeight);

    if (!placement) {
      page = createPageState(pages.length);
      pages.push(page);
      placement = choosePlacement(image, options, page.cursorX, page.cursorY, page.rowHeight);

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

    if (placement.startsNewRow) {
      page.cursorX = 0;
      page.cursorY += page.rowHeight + options.padding;
      page.rowHeight = 0;
    }

    const drawX = placement.x;
    const drawY = placement.y;
    const spriteX = drawX + options.extrude;
    const spriteY = drawY + options.extrude;
    const spriteW = placement.rotated ? image.contentH : image.contentW;
    const spriteH = placement.rotated ? image.contentW : image.contentH;

    const sprite: PackedSprite = {
      name: image.name,
      filePath: image.filePath,
      page: page.index,
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

    page.sprites.push(sprite);
    sprites.push(sprite);
    page.cursorX = drawX + placement.drawW;
    page.rowHeight = Math.max(page.rowHeight, placement.drawH);
    page.usedWidth = Math.max(page.usedWidth, drawX + placement.drawW);
    page.usedHeight = Math.max(page.usedHeight, drawY + placement.drawH);
  }

  const packedPages: PackPage[] = pages.map((page) => ({
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
    algorithm: "shelf",
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

export const shelfPacker: Packer = {
  pack: packSprites
};

function createPageState(index: number): PageState {
  return {
    index,
    sprites: [],
    cursorX: 0,
    cursorY: 0,
    rowHeight: 0,
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

function baseDrawWidth(image: SpriteContent, extrude: number): number {
  return image.contentW + extrude * 2;
}

function baseDrawHeight(image: SpriteContent, extrude: number): number {
  return image.contentH + extrude * 2;
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

function choosePlacement(
  image: SpriteContent,
  options: PackOptions,
  cursorX: number,
  cursorY: number,
  rowHeight: number
): PlacementCandidate | null {
  const candidates = orientationCandidates(image, options);
  const currentRow: PlacementCandidate[] = [];
  const nextRow: PlacementCandidate[] = [];

  for (const candidate of candidates) {
    const x = cursorX === 0 ? 0 : cursorX + options.padding;
    const y = cursorY;

    if (x + candidate.drawW <= options.maxSize && y + candidate.drawH <= options.maxSize) {
      currentRow.push({
        ...candidate,
        x,
        y,
        startsNewRow: false,
        resultingRowHeight: Math.max(rowHeight, candidate.drawH)
      });
    }

    if (cursorX > 0) {
      const nextY = cursorY + rowHeight + options.padding;

      if (candidate.drawW <= options.maxSize && nextY + candidate.drawH <= options.maxSize) {
        nextRow.push({
          ...candidate,
          x: 0,
          y: nextY,
          startsNewRow: true,
          resultingRowHeight: candidate.drawH
        });
      }
    }
  }

  if (currentRow.length > 0) {
    return bestCandidate(currentRow);
  }

  if (nextRow.length > 0) {
    return bestCandidate(nextRow);
  }

  return null;
}

function orientationCandidates(
  image: SpriteContent,
  options: PackOptions
): Array<Pick<PlacementCandidate, "rotated" | "drawW" | "drawH">> {
  const drawW = baseDrawWidth(image, options.extrude);
  const drawH = baseDrawHeight(image, options.extrude);
  const candidates: Array<Pick<PlacementCandidate, "rotated" | "drawW" | "drawH">> = [
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

function bestCandidate(candidates: PlacementCandidate[]): PlacementCandidate {
  return [...candidates].sort((a, b) => {
    const rowHeightDiff = a.resultingRowHeight - b.resultingRowHeight;
    if (rowHeightDiff !== 0) {
      return rowHeightDiff;
    }

    const areaWidthDiff = a.drawW - b.drawW;
    if (areaWidthDiff !== 0) {
      return areaWidthDiff;
    }

    return Number(a.rotated) - Number(b.rotated);
  })[0];
}
