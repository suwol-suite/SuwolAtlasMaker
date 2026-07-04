import type { SpriteCropRect } from "./gui-types.js";
import { clampPivotValue } from "./gui-utils.js";

export type CropResizeHandle = "n" | "s" | "e" | "w" | "nw" | "ne" | "sw" | "se";

export interface SourcePoint {
  x: number;
  y: number;
}

export function sourcePointFromPreviewPoint(
  pointX: number,
  pointY: number,
  sourceW: number,
  sourceH: number,
  previewW: number,
  previewH: number
): SourcePoint {
  const safePreviewW = previewW > 0 ? previewW : sourceW;
  const safePreviewH = previewH > 0 ? previewH : sourceH;

  return {
    x: clampInteger(Math.floor((pointX / safePreviewW) * sourceW), 0, Math.max(0, sourceW)),
    y: clampInteger(Math.floor((pointY / safePreviewH) * sourceH), 0, Math.max(0, sourceH))
  };
}

export function clampCropRect(crop: SpriteCropRect, sourceW: number, sourceH: number): SpriteCropRect {
  const safeW = Math.max(1, Math.floor(sourceW));
  const safeH = Math.max(1, Math.floor(sourceH));
  const w = clampInteger(Math.round(crop.w), 1, safeW);
  const h = clampInteger(Math.round(crop.h), 1, safeH);
  const x = clampInteger(Math.round(crop.x), 0, safeW - w);
  const y = clampInteger(Math.round(crop.y), 0, safeH - h);

  return { x, y, w, h };
}

export function moveCropRect(
  crop: SpriteCropRect,
  deltaX: number,
  deltaY: number,
  sourceW: number,
  sourceH: number
): SpriteCropRect {
  return clampCropRect({
    ...crop,
    x: crop.x + Math.round(deltaX),
    y: crop.y + Math.round(deltaY)
  }, sourceW, sourceH);
}

export function resizeCropRect(
  crop: SpriteCropRect,
  handle: CropResizeHandle,
  deltaX: number,
  deltaY: number,
  sourceW: number,
  sourceH: number
): SpriteCropRect {
  let left = crop.x;
  let top = crop.y;
  let right = crop.x + crop.w;
  let bottom = crop.y + crop.h;
  const dx = Math.round(deltaX);
  const dy = Math.round(deltaY);

  if (handle.includes("w")) {
    left += dx;
  }

  if (handle.includes("e")) {
    right += dx;
  }

  if (handle.includes("n")) {
    top += dy;
  }

  if (handle.includes("s")) {
    bottom += dy;
  }

  left = clampInteger(left, 0, sourceW - 1);
  top = clampInteger(top, 0, sourceH - 1);
  right = clampInteger(right, left + 1, sourceW);
  bottom = clampInteger(bottom, top + 1, sourceH);

  return clampCropRect({
    x: left,
    y: top,
    w: right - left,
    h: bottom - top
  }, sourceW, sourceH);
}

export function centerCropRect(sourceW: number, sourceH: number, width?: number, height?: number): SpriteCropRect {
  const w = clampInteger(Math.round(width ?? sourceW / 2), 1, Math.max(1, sourceW));
  const h = clampInteger(Math.round(height ?? sourceH / 2), 1, Math.max(1, sourceH));

  return {
    x: Math.floor((sourceW - w) / 2),
    y: Math.floor((sourceH - h) / 2),
    w,
    h
  };
}

export function calculatePivotFromCropPoint(
  crop: SpriteCropRect,
  sourceX: number,
  sourceY: number
): { pivotX: number; pivotY: number } {
  return {
    pivotX: clampPivotValue((sourceX - crop.x) / crop.w),
    pivotY: clampPivotValue((sourceY - crop.y) / crop.h)
  };
}

export function calculatePivotPointInCrop(
  crop: SpriteCropRect,
  pivotX: number,
  pivotY: number
): SourcePoint {
  return {
    x: crop.x + crop.w * clampPivotValue(pivotX),
    y: crop.y + crop.h * clampPivotValue(pivotY)
  };
}

export function getEffectiveCropRect(
  crop: SpriteCropRect | undefined,
  autoTrimRect: SpriteCropRect | null | undefined,
  trimMode: "default" | "auto" | "none" | "manual",
  sourceW: number,
  sourceH: number
): SpriteCropRect {
  if (trimMode === "manual" && crop) {
    return clampCropRect(crop, sourceW, sourceH);
  }

  if ((trimMode === "auto" || trimMode === "default") && autoTrimRect) {
    return clampCropRect(autoTrimRect, sourceW, sourceH);
  }

  return {
    x: 0,
    y: 0,
    w: sourceW,
    h: sourceH
  };
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, Math.round(value)));
}
