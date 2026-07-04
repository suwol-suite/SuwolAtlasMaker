import { SuwolAtlasError } from "../../shared/errors.js";
import { DEFAULT_SIZE_MODE, isSizeMode, type SizeMode } from "../../shared/sizeMode.js";
import type { PackPage, PackResult } from "../packer/types.js";

export function parseSizeMode(value: unknown): SizeMode {
  if (value === undefined) {
    return DEFAULT_SIZE_MODE;
  }

  if (!isSizeMode(value)) {
    throw new SuwolAtlasError('Unsupported size mode. Expected "tight", "pot", or "square-pot".', {
      code: "UNSUPPORTED_SIZE_MODE"
    });
  }

  return value;
}

export function applySizeMode(packResult: PackResult, sizeMode: SizeMode, maxSize: number): PackResult {
  if (!Number.isInteger(maxSize) || maxSize <= 0) {
    throw new SuwolAtlasError("--max-size must be a positive integer.", {
      code: "INVALID_MAX_SIZE"
    });
  }

  const pages = packResult.pages.map((page) => resizePage(page, sizeMode, maxSize));

  return {
    ...packResult,
    pages,
    logs: [
      ...packResult.logs,
      `Size mode: ${sizeMode}.`,
      ...pages.map((page) =>
        `Page ${page.index} final size: ${page.width}x${page.height}; raw size: ${page.rawWidth}x${page.rawHeight}.`
      )
    ]
  };
}

export function resolvePageSize(width: number, height: number, sizeMode: SizeMode, maxSize: number): { width: number; height: number } {
  if (width < 0 || height < 0) {
    throw new SuwolAtlasError("Page size must not be negative.", {
      code: "INVALID_PAGE_SIZE"
    });
  }

  let nextWidth = width;
  let nextHeight = height;

  if (sizeMode === "pot") {
    nextWidth = nextPowerOfTwo(Math.max(1, width));
    nextHeight = nextPowerOfTwo(Math.max(1, height));
  } else if (sizeMode === "square-pot") {
    const side = nextPowerOfTwo(Math.max(1, width, height));
    nextWidth = side;
    nextHeight = side;
  }

  if (nextWidth > maxSize || nextHeight > maxSize) {
    throw new SuwolAtlasError(
      `Page final size ${nextWidth}x${nextHeight} exceeds max size ${maxSize}x${maxSize} after size-mode ${sizeMode}.`,
      {
        code: "SIZE_MODE_EXCEEDS_MAX_SIZE"
      }
    );
  }

  return {
    width: nextWidth,
    height: nextHeight
  };
}

export function nextPowerOfTwo(value: number): number {
  if (!Number.isFinite(value) || value <= 1) {
    return 1;
  }

  return 2 ** Math.ceil(Math.log2(value));
}

function resizePage(page: PackPage, sizeMode: SizeMode, maxSize: number): PackPage {
  const rawWidth = page.rawWidth ?? page.width;
  const rawHeight = page.rawHeight ?? page.height;
  const finalSize = resolvePageSize(rawWidth, rawHeight, sizeMode, maxSize);

  return {
    ...page,
    rawWidth,
    rawHeight,
    width: finalSize.width,
    height: finalSize.height
  };
}
