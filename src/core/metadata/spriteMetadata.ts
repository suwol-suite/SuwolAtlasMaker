import { SuwolAtlasError } from "../../shared/errors.js";
import type {
  NormalizedSpriteMetadata,
  SpriteCropRect,
  SpriteMetadataEntry,
  SpriteMetadataMap,
  SpriteTrimMode
} from "./metadataTypes.js";

const FORBIDDEN_NAME_CHARS = /[\\/:"*?<>|]/;
const MAX_TAG_LENGTH = 64;
const TRIM_MODES = new Set<SpriteTrimMode>(["default", "auto", "none", "manual"]);

export function normalizeMetadataPathKey(value: string): string {
  return value
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/^\.\//, "")
    .trim();
}

export function normalizeSpriteMetadataMap(value: unknown): SpriteMetadataMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const source = value as Record<string, unknown>;
  const normalized: SpriteMetadataMap = {};

  for (const [rawKey, rawEntry] of Object.entries(source)) {
    const key = normalizeMetadataPathKey(rawKey);

    if (!key || !rawEntry || typeof rawEntry !== "object" || Array.isArray(rawEntry)) {
      continue;
    }

    normalized[key] = normalizeSpriteMetadataEntry(rawEntry as SpriteMetadataEntry);
  }

  return normalized;
}

export function normalizeSpriteMetadataEntry(entry: SpriteMetadataEntry | undefined): SpriteMetadataEntry {
  if (!entry) {
    return {};
  }

  const raw = entry as Record<string, unknown>;
  const normalized: SpriteMetadataEntry = {};

  if ("include" in raw) {
    normalized.include = raw.include as boolean;
  }

  if (typeof raw.nameOverride === "string") {
    const nameOverride = raw.nameOverride.trim();
    normalized.nameOverride = nameOverride;
  } else if ("nameOverride" in raw) {
    normalized.nameOverride = raw.nameOverride as string;
  }

  if ("pivotX" in raw) {
    normalized.pivotX = raw.pivotX as number;
  }

  if ("pivotY" in raw) {
    normalized.pivotY = raw.pivotY as number;
  }

  if (Array.isArray(raw.tags)) {
    const tags: string[] = [];
    const seen = new Set<string>();

    for (const item of raw.tags) {
      if (typeof item !== "string") {
        tags.push(item as string);
        continue;
      }

      const tag = item.trim();
      const key = tag.toLowerCase();

      if (tag && !seen.has(key)) {
        seen.add(key);
        tags.push(tag);
      }
    }

    normalized.tags = tags;
  } else if ("tags" in raw) {
    normalized.tags = raw.tags as string[];
  }

  if (typeof raw.group === "string") {
    normalized.group = raw.group.trim();
  } else if ("group" in raw) {
    normalized.group = raw.group as string;
  }

  if ("order" in raw) {
    normalized.order = raw.order as number;
  }

  if (typeof raw.trimMode === "string") {
    normalized.trimMode = raw.trimMode as SpriteTrimMode;
  } else if ("trimMode" in raw) {
    normalized.trimMode = raw.trimMode as SpriteTrimMode;
  }

  if (raw.crop && typeof raw.crop === "object" && !Array.isArray(raw.crop)) {
    const crop = raw.crop as Record<string, unknown>;
    normalized.crop = {
      x: crop.x as number,
      y: crop.y as number,
      w: crop.w as number,
      h: crop.h as number
    };
  } else if ("crop" in raw) {
    normalized.crop = raw.crop as SpriteCropRect;
  }

  return normalized;
}

export function validateAndResolveSpriteMetadata(
  entry: SpriteMetadataEntry | undefined,
  sourcePath: string,
  sourceWidth?: number,
  sourceHeight?: number
): NormalizedSpriteMetadata {
  const metadata = normalizeSpriteMetadataEntry(entry);
  const include = metadata.include === undefined ? true : metadata.include;
  const pivotX = metadata.pivotX === undefined ? 0.5 : metadata.pivotX;
  const pivotY = metadata.pivotY === undefined ? 0.5 : metadata.pivotY;
  const tags = metadata.tags === undefined ? [] : metadata.tags;
  const group = metadata.group === undefined ? "" : metadata.group;
  const trimMode = metadata.trimMode === undefined ? "default" : metadata.trimMode;

  if (typeof include !== "boolean") {
    throw metadataError(`Sprite metadata include must be a boolean for "${sourcePath}".`, sourcePath, "INVALID_METADATA_INCLUDE");
  }

  if (metadata.nameOverride !== undefined) {
    validateNameOverride(metadata.nameOverride, sourcePath);
  }

  validatePivot(pivotX, "pivotX", sourcePath);
  validatePivot(pivotY, "pivotY", sourcePath);
  validateOrder(metadata.order, sourcePath);
  validateTrimMode(trimMode, sourcePath);

  const crop = validateCrop(metadata.crop, trimMode, sourcePath, sourceWidth, sourceHeight);

  if (!Array.isArray(tags)) {
    throw metadataError(`Sprite metadata tags must be a string array for "${sourcePath}".`, sourcePath, "INVALID_METADATA_TAGS");
  }

  const resolvedTags: string[] = [];
  const seenTags = new Set<string>();

  for (const tag of tags) {
    if (typeof tag !== "string") {
      throw metadataError(`Sprite metadata tags must only contain strings for "${sourcePath}".`, sourcePath, "INVALID_METADATA_TAGS");
    }

    const trimmed = tag.trim();

    if (!trimmed) {
      continue;
    }

    if (trimmed.length > MAX_TAG_LENGTH) {
      throw metadataError(`Sprite metadata tag is too long for "${sourcePath}": "${trimmed}".`, sourcePath, "INVALID_METADATA_TAG");
    }

    const key = trimmed.toLowerCase();

    if (!seenTags.has(key)) {
      seenTags.add(key);
      resolvedTags.push(trimmed);
    }
  }

  if (typeof group !== "string") {
    throw metadataError(`Sprite metadata group must be a string for "${sourcePath}".`, sourcePath, "INVALID_METADATA_GROUP");
  }

  const resolvedGroup = group.trim();

  if (resolvedGroup.length > MAX_TAG_LENGTH) {
    throw metadataError(`Sprite metadata group is too long for "${sourcePath}": "${resolvedGroup}".`, sourcePath, "INVALID_METADATA_GROUP");
  }

  return {
    include,
    nameOverride: metadata.nameOverride,
    pivotX,
    pivotY,
    tags: resolvedTags,
    group: resolvedGroup,
    order: metadata.order,
    trimMode,
    crop
  };
}

export function validateNameOverride(name: string, sourcePath: string): void {
  const trimmed = typeof name === "string" ? name.trim() : "";

  if (!trimmed) {
    throw metadataError(`Sprite metadata nameOverride must not be empty for "${sourcePath}".`, sourcePath, "INVALID_METADATA_NAME");
  }

  if (FORBIDDEN_NAME_CHARS.test(trimmed)) {
    throw metadataError(
      `Sprite metadata nameOverride contains a forbidden file/path character for "${sourcePath}": "${trimmed}".`,
      sourcePath,
      "INVALID_METADATA_NAME"
    );
  }
}

export function hasTagOrGroupMetadata(metadata: SpriteMetadataMap | undefined): boolean {
  if (!metadata) {
    return false;
  }

  return Object.values(metadata).some((entry) => {
    const normalized = normalizeSpriteMetadataEntry(entry);
    const tags = Array.isArray(normalized.tags)
      ? normalized.tags.filter((tag) => typeof tag === "string" && tag.trim())
      : [];
    const group = typeof normalized.group === "string" ? normalized.group.trim() : "";
    return tags.length > 0 || group.length > 0;
  });
}

export function hasSidecarMetadata(metadata: SpriteMetadataMap | undefined): boolean {
  if (!metadata) {
    return false;
  }

  return Object.values(metadata).some((entry) => {
    const normalized = normalizeSpriteMetadataEntry(entry);
    const tags = Array.isArray(normalized.tags)
      ? normalized.tags.filter((tag) => typeof tag === "string" && tag.trim())
      : [];
    const group = typeof normalized.group === "string" ? normalized.group.trim() : "";
    return tags.length > 0 ||
      group.length > 0 ||
      normalized.order !== undefined ||
      (normalized.trimMode !== undefined && normalized.trimMode !== "default") ||
      normalized.crop !== undefined;
  });
}

function validatePivot(value: unknown, field: "pivotX" | "pivotY", sourcePath: string): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw metadataError(
      `Sprite metadata ${field} must be a number from 0 to 1 for "${sourcePath}".`,
      sourcePath,
      "INVALID_METADATA_PIVOT"
    );
  }
}

function validateOrder(value: unknown, sourcePath: string): void {
  if (value === undefined) {
    return;
  }

  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    throw metadataError(
      `Sprite metadata order must be a non-negative integer for "${sourcePath}".`,
      sourcePath,
      "INVALID_METADATA_ORDER"
    );
  }
}

function validateTrimMode(value: unknown, sourcePath: string): asserts value is SpriteTrimMode {
  if (typeof value !== "string" || !TRIM_MODES.has(value as SpriteTrimMode)) {
    throw metadataError(
      `Sprite metadata trimMode must be one of default, auto, none, or manual for "${sourcePath}".`,
      sourcePath,
      "INVALID_METADATA_TRIM_MODE"
    );
  }
}

function validateCrop(
  value: unknown,
  trimMode: SpriteTrimMode,
  sourcePath: string,
  sourceWidth?: number,
  sourceHeight?: number
): SpriteCropRect | undefined {
  if (trimMode === "manual" && value === undefined) {
    throw metadataError(`Sprite metadata crop is required when trimMode is manual for "${sourcePath}".`, sourcePath, "INVALID_METADATA_CROP");
  }

  if (value === undefined || trimMode !== "manual") {
    return undefined;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw metadataError(`Sprite metadata crop must be an object for "${sourcePath}".`, sourcePath, "INVALID_METADATA_CROP");
  }

  const crop = value as Partial<SpriteCropRect>;
  const fields: Array<keyof SpriteCropRect> = ["x", "y", "w", "h"];

  for (const field of fields) {
    if (!Number.isInteger(crop[field])) {
      throw metadataError(`Sprite metadata crop.${field} must be an integer for "${sourcePath}".`, sourcePath, "INVALID_METADATA_CROP");
    }
  }

  if (crop.x! < 0 || crop.y! < 0 || crop.w! <= 0 || crop.h! <= 0) {
    throw metadataError(
      `Sprite metadata crop must have x/y >= 0 and w/h > 0 for "${sourcePath}".`,
      sourcePath,
      "INVALID_METADATA_CROP"
    );
  }

  if (
    sourceWidth !== undefined &&
    sourceHeight !== undefined &&
    (crop.x! + crop.w! > sourceWidth || crop.y! + crop.h! > sourceHeight)
  ) {
    throw metadataError(
      `Sprite metadata crop is outside source image bounds for "${sourcePath}".`,
      sourcePath,
      "INVALID_METADATA_CROP_BOUNDS"
    );
  }

  return {
    x: crop.x!,
    y: crop.y!,
    w: crop.w!,
    h: crop.h!
  };
}

function metadataError(message: string, filePath: string, code: string): SuwolAtlasError {
  return new SuwolAtlasError(message, {
    code,
    filePath
  });
}
