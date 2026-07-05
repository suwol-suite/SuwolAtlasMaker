import type {
  GuiAtlasJson,
  GuiAtlasJsonPage,
  GuiAtlasJsonSprite,
  GuiExportOptions,
  GuiInputSpriteScanItem,
  GuiProfileId,
  GuiSettings,
  GuiValidationResult
} from "./gui-types.js";
import type { SpriteCropRect, SpriteMetadataEntry, SpriteMetadataMap, SpriteTrimMode } from "../core/metadata/metadataTypes.js";
import { normalizeMetadataPathKey, normalizeSpriteMetadataEntry } from "../core/metadata/spriteMetadata.js";
import { DEFAULT_GUI_LAYOUT, normalizeGuiLayoutSettings } from "./gui-layout.js";
import { DEFAULT_APP_LANGUAGE } from "./i18n/types.js";
import { normalizeAppLanguage } from "./i18n/language.js";
import { DEFAULT_PACKING_ALGORITHM, isPackingAlgorithm, normalizePackingAlgorithm } from "./packing.js";
import { DEFAULT_SIZE_MODE, isSizeMode, normalizeSizeMode } from "./sizeMode.js";

export const DEFAULT_GUI_SETTINGS: GuiSettings = {
  inputDir: "",
  outputDir: "",
  name: "sample_atlas",
  maxSize: 2048,
  padding: 2,
  trim: false,
  extrude: 0,
  rotate: false,
  clean: true,
  algorithm: DEFAULT_PACKING_ALGORITHM,
  sizeMode: DEFAULT_SIZE_MODE,
  cache: false,
  watch: false,
  profile: "generic",
  spriteMetadata: {},
  lastProjectPath: null,
  recentProjectPaths: [],
  recentInputDirs: [],
  recentOutputDirs: [],
  previewZoom: 1,
  windowWidth: 1280,
  windowHeight: 820,
  language: DEFAULT_APP_LANGUAGE,
  layout: DEFAULT_GUI_LAYOUT,
  advancedCollapsed: DEFAULT_GUI_LAYOUT.advancedCollapsed,
  logCollapsed: !DEFAULT_GUI_LAYOUT.statusPanelOpen,
  rightPanelTab: DEFAULT_GUI_LAYOUT.rightPanelTab,
  useRecommendedSettings: false
};

export const ALLOWED_MAX_SIZES = new Set([1024, 2048, 4096, 8192]);
const ALLOWED_PROFILES = new Set<GuiProfileId>(["generic", "unity", "monogame"]);

export function normalizeGuiSettings(value: unknown): GuiSettings {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_GUI_SETTINGS };
  }

  const partial = value as Partial<GuiSettings>;
  const normalized: GuiSettings = {
    ...DEFAULT_GUI_SETTINGS,
    ...partial
  };

  normalized.inputDir = typeof partial.inputDir === "string" ? partial.inputDir : "";
  normalized.outputDir = typeof partial.outputDir === "string" ? partial.outputDir : "";
  normalized.name = typeof partial.name === "string" && partial.name.trim() ? partial.name : DEFAULT_GUI_SETTINGS.name;
  normalized.maxSize = normalizeMaxSize(partial.maxSize, DEFAULT_GUI_SETTINGS.maxSize);
  normalized.padding = normalizeNonNegativeInteger(partial.padding, DEFAULT_GUI_SETTINGS.padding);
  normalized.extrude = normalizeNonNegativeInteger(partial.extrude, DEFAULT_GUI_SETTINGS.extrude);
  normalized.trim = Boolean(partial.trim);
  normalized.rotate = Boolean(partial.rotate);
  normalized.clean = partial.clean === undefined ? DEFAULT_GUI_SETTINGS.clean : Boolean(partial.clean);
  normalized.algorithm = normalizePackingAlgorithm(partial.algorithm);
  normalized.sizeMode = normalizeSizeMode(partial.sizeMode);
  normalized.cache = partial.cache === undefined ? DEFAULT_GUI_SETTINGS.cache : Boolean(partial.cache);
  normalized.watch = partial.watch === undefined ? DEFAULT_GUI_SETTINGS.watch : Boolean(partial.watch);
  normalized.profile = normalizeProfile(partial.profile);
  normalized.spriteMetadata = normalizeSpriteMetadataMapForGui(partial.spriteMetadata);
  normalized.lastProjectPath = typeof partial.lastProjectPath === "string" && partial.lastProjectPath.trim()
    ? partial.lastProjectPath
    : null;
  normalized.recentProjectPaths = normalizeRecentProjectPaths(partial.recentProjectPaths);
  normalized.recentInputDirs = normalizeRecentProjectPaths(partial.recentInputDirs);
  normalized.recentOutputDirs = normalizeRecentProjectPaths(partial.recentOutputDirs);
  normalized.previewZoom = normalizePreviewZoom(partial.previewZoom, DEFAULT_GUI_SETTINGS.previewZoom);
  normalized.windowWidth = Math.max(900, normalizePositiveInteger(partial.windowWidth, DEFAULT_GUI_SETTINGS.windowWidth));
  normalized.windowHeight = Math.max(640, normalizePositiveInteger(partial.windowHeight, DEFAULT_GUI_SETTINGS.windowHeight));
  normalized.language = normalizeAppLanguage(partial.language);
  normalized.layout = normalizeGuiLayoutSettings(partial.layout, {
    advancedCollapsed: partial.advancedCollapsed,
    statusPanelOpen: partial.logCollapsed === undefined ? undefined : !partial.logCollapsed,
    rightPanelTab: partial.rightPanelTab
  });
  normalized.advancedCollapsed = normalized.layout.advancedCollapsed;
  normalized.logCollapsed = !normalized.layout.statusPanelOpen;
  normalized.rightPanelTab = normalized.layout.rightPanelTab;
  normalized.useRecommendedSettings = Boolean(partial.useRecommendedSettings);

  return normalized;
}

export function validateGuiExportOptions(options: GuiExportOptions): GuiValidationResult {
  const errors: string[] = [];

  if (!options.inputDir.trim()) {
    errors.push("Input folder is required.");
  }

  if (!options.outputDir.trim()) {
    errors.push("Output folder is required.");
  }

  if (!options.name.trim()) {
    errors.push("Atlas name is required.");
  }

  if (!Number.isInteger(options.maxSize) || options.maxSize <= 0) {
    errors.push("Max size must be a positive integer.");
  }

  if (!ALLOWED_MAX_SIZES.has(options.maxSize)) {
    errors.push("Max size must be one of 1024, 2048, 4096, or 8192.");
  }

  if (!Number.isInteger(options.padding) || options.padding < 0) {
    errors.push("Padding must be a non-negative integer.");
  }

  if (!Number.isInteger(options.extrude) || options.extrude < 0) {
    errors.push("Extrude must be a non-negative integer.");
  }

  if (!isPackingAlgorithm(options.algorithm)) {
    errors.push('Algorithm must be "shelf" or "maxrects".');
  }

  if (!isSizeMode(options.sizeMode)) {
    errors.push('Size mode must be "tight", "pot", or "square-pot".');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export type GuiFriendlyErrorCode =
  | "inputRequired"
  | "outputRequired"
  | "nameRequired"
  | "noPngFiles"
  | "duplicateSpriteName"
  | "maxSizeExceeded"
  | "cropInvalid"
  | "outputFolderMissing"
  | "sampleMissing"
  | "fallback";

export interface GuiFriendlyError {
  code: GuiFriendlyErrorCode;
  detail: string;
}

export function classifyGuiError(message: string): GuiFriendlyError {
  const normalized = message.toLowerCase();

  if (message === "Input folder is required.") {
    return { code: "inputRequired", detail: message };
  }

  if (message === "Output folder is required.") {
    return { code: "outputRequired", detail: message };
  }

  if (message === "Atlas name is required.") {
    return { code: "nameRequired", detail: message };
  }

  if (normalized.includes("no png files found")) {
    return { code: "noPngFiles", detail: message };
  }

  if (normalized.includes("duplicate export sprite name")) {
    return { code: "duplicateSpriteName", detail: message };
  }

  if (normalized.includes("exceeds max size") || normalized.includes("cannot fit into a new atlas page")) {
    return { code: "maxSizeExceeded", detail: message };
  }

  if (
    normalized.includes("crop is outside source image bounds") ||
    normalized.includes("crop width extends beyond") ||
    normalized.includes("crop height extends beyond") ||
    normalized.includes("invalid_metadata_crop_bounds")
  ) {
    return { code: "cropInvalid", detail: message };
  }

  if (
    normalized.includes("output directory path is required") ||
    normalized.includes("output path is not a directory") ||
    normalized.includes("output directory does not exist")
  ) {
    return { code: "outputFolderMissing", detail: message };
  }

  if (normalized.includes("sample project is not available")) {
    return { code: "sampleMissing", detail: message };
  }

  return { code: "fallback", detail: message };
}

export function formatElapsedMs(elapsedMs: number): string {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
    return "-";
  }

  if (elapsedMs < 1000) {
    return `${Math.max(0, Math.round(elapsedMs))} ms`;
  }

  return `${(elapsedMs / 1000).toFixed(elapsedMs < 10000 ? 1 : 0)} s`;
}

export interface ExportResultSummary {
  pageCount: number;
  spriteCount: number;
  outputFiles: string[];
  elapsed: string;
}

export function buildExportResultSummary(result: {
  spriteCount: number;
  previewPages: unknown[];
  pngPaths: string[];
  jsonPath: string;
  logPath: string;
  metadataPath?: string;
  elapsedMs: number;
}): ExportResultSummary {
  return {
    pageCount: result.previewPages.length,
    spriteCount: result.spriteCount,
    outputFiles: [
      ...result.pngPaths,
      result.jsonPath,
      ...(result.metadataPath ? [result.metadataPath] : []),
      result.logPath
    ],
    elapsed: formatElapsedMs(result.elapsedMs)
  };
}

export function toCoreMakeAtlasOptions(options: GuiExportOptions) {
  return {
    name: options.name.trim(),
    maxSize: options.maxSize,
    padding: options.padding,
    format: "json" as const,
    clean: options.clean,
    trim: options.trim,
    extrude: options.extrude,
    rotate: options.rotate,
    algorithm: options.algorithm,
    sizeMode: options.sizeMode,
    cache: options.cache,
    spriteMetadata: options.spriteMetadata
  };
}

export function normalizeProfile(value: unknown): GuiProfileId {
  return typeof value === "string" && ALLOWED_PROFILES.has(value as GuiProfileId)
    ? value as GuiProfileId
    : DEFAULT_GUI_SETTINGS.profile;
}

export function filterSprites(sprites: GuiAtlasJsonSprite[], query: string): GuiAtlasJsonSprite[] {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return sprites;
  }

  return sprites.filter((sprite) => sprite.name.toLowerCase().includes(normalized));
}

export function normalizeSpriteMetadataMapForGui(value: unknown): SpriteMetadataMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const result: SpriteMetadataMap = {};

  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const normalizedKey = normalizeMetadataPathKey(key);

    if (!normalizedKey || !entry || typeof entry !== "object" || Array.isArray(entry)) {
      continue;
    }

    result[normalizedKey] = normalizeSpriteMetadataEntry(entry as SpriteMetadataEntry);
  }

  return result;
}

export function getSpriteMetadataEntry(metadata: SpriteMetadataMap, relativePath: string): SpriteMetadataEntry {
  return metadata[normalizeMetadataPathKey(relativePath)] ?? {};
}

export function setSpriteMetadataEntry(
  metadata: SpriteMetadataMap,
  relativePath: string,
  entry: SpriteMetadataEntry
): SpriteMetadataMap {
  const key = normalizeMetadataPathKey(relativePath);
  const normalized = normalizeSpriteMetadataEntry(entry);
  const next = { ...metadata };

  if (normalized.nameOverride === "") {
    delete normalized.nameOverride;
  }

  if (isEmptySpriteMetadataEntry(normalized)) {
    delete next[key];
  } else {
    next[key] = normalized;
  }

  return next;
}

export function resetSpriteMetadataEntries(metadata: SpriteMetadataMap, relativePaths: string[]): SpriteMetadataMap {
  const next = { ...metadata };

  for (const relativePath of relativePaths) {
    delete next[normalizeMetadataPathKey(relativePath)];
  }

  return next;
}

export function includeAllSprites(metadata: SpriteMetadataMap, sprites: GuiInputSpriteScanItem[]): SpriteMetadataMap {
  let next = { ...metadata };

  for (const sprite of sprites) {
    const entry = getSpriteMetadataEntry(next, sprite.relativePath);
    next = setSpriteMetadataEntry(next, sprite.relativePath, {
      ...entry,
      include: true
    });
  }

  return next;
}

export function excludeSprites(metadata: SpriteMetadataMap, relativePaths: string[]): SpriteMetadataMap {
  let next = { ...metadata };

  for (const relativePath of relativePaths) {
    const entry = getSpriteMetadataEntry(next, relativePath);
    next = setSpriteMetadataEntry(next, relativePath, {
      ...entry,
      include: false
    });
  }

  return next;
}

export function clearNameOverrides(metadata: SpriteMetadataMap): SpriteMetadataMap {
  const next: SpriteMetadataMap = {};

  for (const [key, entry] of Object.entries(metadata)) {
    const { nameOverride: _nameOverride, ...rest } = entry;
    const normalized = normalizeSpriteMetadataEntry(rest);

    if (!isEmptySpriteMetadataEntry(normalized)) {
      next[key] = normalized;
    }
  }

  return next;
}

export function clearTagsAndGroups(metadata: SpriteMetadataMap): SpriteMetadataMap {
  const next: SpriteMetadataMap = {};

  for (const [key, entry] of Object.entries(metadata)) {
    const { tags: _tags, group: _group, ...rest } = entry;
    const normalized = normalizeSpriteMetadataEntry(rest);

    if (!isEmptySpriteMetadataEntry(normalized)) {
      next[key] = normalized;
    }
  }

  return next;
}

export type InputSpriteIncludeFilter = "all" | "included" | "excluded";
export type InputSpriteSortKey = "source" | "export" | "group" | "include" | "trim" | "order" | "invalid";

export interface InputSpriteFilters {
  query?: string;
  include?: InputSpriteIncludeFilter;
  group?: string;
  tag?: string;
  trimMode?: "all" | SpriteTrimMode;
  hasNameOverride?: boolean;
  hasCrop?: boolean;
  invalidOnly?: boolean;
  missingOnly?: boolean;
  sortBy?: InputSpriteSortKey;
}

export function filterAndSortInputSprites(
  sprites: GuiInputSpriteScanItem[],
  filters: InputSpriteFilters
): GuiInputSpriteScanItem[] {
  const query = filters.query?.trim().toLowerCase() ?? "";
  const group = filters.group?.trim().toLowerCase() ?? "";
  const tag = filters.tag?.trim().toLowerCase() ?? "";
  const include = filters.include ?? "all";
  const trimMode = filters.trimMode ?? "all";
  const sortBy = filters.sortBy ?? "order";

  return sprites
    .filter((sprite) => {
      if (query && ![
        sprite.relativePath,
        sprite.exportName,
        sprite.group,
        sprite.trimMode,
        `${sprite.order ?? ""}`,
        sprite.tags.join(" ")
      ].some((value) => value.toLowerCase().includes(query))) {
        return false;
      }

      if (include === "included" && !sprite.include) {
        return false;
      }

      if (include === "excluded" && sprite.include) {
        return false;
      }

      if (group && sprite.group.toLowerCase() !== group) {
        return false;
      }

      if (tag && !sprite.tags.some((item) => item.toLowerCase() === tag)) {
        return false;
      }

      if (trimMode !== "all" && sprite.trimMode !== trimMode) {
        return false;
      }

      if (filters.hasNameOverride && !sprite.nameOverride) {
        return false;
      }

      if (filters.hasCrop && !sprite.crop) {
        return false;
      }

      if (filters.invalidOnly && sprite.status !== "invalid" && sprite.status !== "missing") {
        return false;
      }

      if (filters.missingOnly && sprite.status !== "missing") {
        return false;
      }

      return true;
    })
    .sort((a, b) => compareInputSprites(a, b, sortBy));
}

export function reorderInputSpriteOrder(
  metadata: SpriteMetadataMap,
  sprites: GuiInputSpriteScanItem[],
  relativePath: string,
  action: "up" | "down" | "top" | "bottom"
): SpriteMetadataMap {
  const ordered = [...sprites].sort((a, b) => compareInputSprites(a, b, "order"));
  const index = ordered.findIndex((sprite) => sprite.relativePath === relativePath);

  if (index < 0) {
    return metadata;
  }

  const [item] = ordered.splice(index, 1);
  const nextIndex = action === "top"
    ? 0
    : action === "bottom"
      ? ordered.length
      : action === "up"
        ? Math.max(0, index - 1)
        : Math.min(ordered.length, index + 1);

  ordered.splice(nextIndex, 0, item);
  return applySpriteOrder(metadata, ordered.map((sprite) => sprite.relativePath));
}

export function reorderVisibleInputSpriteOrder(
  metadata: SpriteMetadataMap,
  allSprites: GuiInputSpriteScanItem[],
  visibleRelativePaths: string[],
  draggedRelativePath: string,
  targetRelativePath: string
): SpriteMetadataMap {
  if (draggedRelativePath === targetRelativePath) {
    return metadata;
  }

  const canonicalPaths = [...allSprites]
    .sort((a, b) => compareInputSprites(a, b, "order"))
    .map((sprite) => sprite.relativePath);
  const existingPaths = new Set(canonicalPaths);
  const seenVisible = new Set<string>();
  const visiblePaths = visibleRelativePaths.filter((relativePath) => {
    if (!existingPaths.has(relativePath) || seenVisible.has(relativePath)) {
      return false;
    }

    seenVisible.add(relativePath);
    return true;
  });

  if (!visiblePaths.includes(draggedRelativePath) || !visiblePaths.includes(targetRelativePath)) {
    return metadata;
  }

  const reorderedVisible = visiblePaths.filter((relativePath) => relativePath !== draggedRelativePath);
  const targetIndex = reorderedVisible.indexOf(targetRelativePath);
  reorderedVisible.splice(targetIndex >= 0 ? targetIndex : reorderedVisible.length, 0, draggedRelativePath);

  const visibleSet = new Set(visiblePaths);
  const visibleQueue = [...reorderedVisible];
  const finalPaths = canonicalPaths.map((relativePath) => visibleSet.has(relativePath)
    ? visibleQueue.shift() ?? relativePath
    : relativePath);

  return applySpriteOrder(metadata, finalPaths);
}

export function applySpriteOrder(metadata: SpriteMetadataMap, relativePaths: string[]): SpriteMetadataMap {
  let next = { ...metadata };

  relativePaths.forEach((relativePath, index) => {
    const entry = getSpriteMetadataEntry(next, relativePath);
    next = setSpriteMetadataEntry(next, relativePath, {
      ...entry,
      order: index * 10
    });
  });

  return next;
}

export function resetSpriteOrder(metadata: SpriteMetadataMap): SpriteMetadataMap {
  const next: SpriteMetadataMap = {};

  for (const [key, entry] of Object.entries(metadata)) {
    const { order: _order, ...rest } = entry;
    const normalized = normalizeSpriteMetadataEntry(rest);

    if (!isEmptySpriteMetadataEntry(normalized)) {
      next[key] = normalized;
    }
  }

  return next;
}

export function setGroupForSprites(metadata: SpriteMetadataMap, relativePaths: string[], group: string): SpriteMetadataMap {
  let next = { ...metadata };

  for (const relativePath of relativePaths) {
    const entry = getSpriteMetadataEntry(next, relativePath);
    next = setSpriteMetadataEntry(next, relativePath, {
      ...entry,
      group
    });
  }

  return next;
}

export function setTrimModeForSprites(metadata: SpriteMetadataMap, relativePaths: string[], trimMode: SpriteTrimMode): SpriteMetadataMap {
  let next = { ...metadata };

  for (const relativePath of relativePaths) {
    const entry = getSpriteMetadataEntry(next, relativePath);
    next = setSpriteMetadataEntry(next, relativePath, {
      ...entry,
      trimMode,
      crop: trimMode === "manual" ? entry.crop : undefined
    });
  }

  return next;
}

export function setIncludeForSprites(metadata: SpriteMetadataMap, relativePaths: string[], include: boolean): SpriteMetadataMap {
  let next = { ...metadata };

  for (const relativePath of relativePaths) {
    const entry = getSpriteMetadataEntry(next, relativePath);
    next = setSpriteMetadataEntry(next, relativePath, {
      ...entry,
      include
    });
  }

  return next;
}

export function addTagsForSprites(metadata: SpriteMetadataMap, relativePaths: string[], tags: string[]): SpriteMetadataMap {
  const normalizedTags = normalizeTags(tags);
  let next = { ...metadata };

  if (normalizedTags.length === 0) {
    return next;
  }

  for (const relativePath of relativePaths) {
    const entry = getSpriteMetadataEntry(next, relativePath);
    const merged = normalizeTags([...(entry.tags ?? []), ...normalizedTags]);
    next = setSpriteMetadataEntry(next, relativePath, {
      ...entry,
      tags: merged
    });
  }

  return next;
}

export function removeTagsForSprites(metadata: SpriteMetadataMap, relativePaths: string[], tags: string[]): SpriteMetadataMap {
  const remove = new Set(normalizeTags(tags).map((tag) => tag.toLowerCase()));
  let next = { ...metadata };

  if (remove.size === 0) {
    return next;
  }

  for (const relativePath of relativePaths) {
    const entry = getSpriteMetadataEntry(next, relativePath);
    const tags = (entry.tags ?? []).filter((tag) => !remove.has(tag.toLowerCase()));
    next = setSpriteMetadataEntry(next, relativePath, {
      ...entry,
      tags
    });
  }

  return next;
}

export function resetCropForSprites(metadata: SpriteMetadataMap, relativePaths: string[]): SpriteMetadataMap {
  let next = { ...metadata };

  for (const relativePath of relativePaths) {
    const entry = getSpriteMetadataEntry(next, relativePath);
    const { crop: _crop, ...rest } = entry;
    next = setSpriteMetadataEntry(next, relativePath, {
      ...rest,
      trimMode: "default"
    });
  }

  return next;
}

export function resetPivotForSprites(metadata: SpriteMetadataMap, relativePaths: string[]): SpriteMetadataMap {
  let next = { ...metadata };

  for (const relativePath of relativePaths) {
    const entry = getSpriteMetadataEntry(next, relativePath);
    const { pivotX: _pivotX, pivotY: _pivotY, ...rest } = entry;
    next = setSpriteMetadataEntry(next, relativePath, rest);
  }

  return next;
}

export function assignSequentialOrderForSprites(
  metadata: SpriteMetadataMap,
  relativePaths: string[],
  start = 0,
  step = 10
): SpriteMetadataMap {
  let next = { ...metadata };

  relativePaths.forEach((relativePath, index) => {
    const entry = getSpriteMetadataEntry(next, relativePath);
    next = setSpriteMetadataEntry(next, relativePath, {
      ...entry,
      order: start + index * step
    });
  });

  return next;
}

export function getMissingSpriteMetadataPaths(
  metadata: SpriteMetadataMap,
  sprites: GuiInputSpriteScanItem[]
): string[] {
  const existing = new Set(sprites.map((sprite) => normalizeMetadataPathKey(sprite.relativePath)));

  return Object.keys(metadata)
    .filter((key) => !existing.has(normalizeMetadataPathKey(key)))
    .sort((a, b) => a.localeCompare(b));
}

export function removeMissingSpriteMetadata(
  metadata: SpriteMetadataMap,
  sprites: GuiInputSpriteScanItem[]
): SpriteMetadataMap {
  const missing = new Set(getMissingSpriteMetadataPaths(metadata, sprites).map((key) => normalizeMetadataPathKey(key)));
  const next: SpriteMetadataMap = {};

  for (const [key, entry] of Object.entries(metadata)) {
    if (!missing.has(normalizeMetadataPathKey(key))) {
      next[key] = entry;
    }
  }

  return next;
}

export function createMissingMetadataScanItems(
  metadata: SpriteMetadataMap,
  sprites: GuiInputSpriteScanItem[]
): GuiInputSpriteScanItem[] {
  return getMissingSpriteMetadataPaths(metadata, sprites).map((relativePath) => {
    const entry = getSpriteMetadataEntry(metadata, relativePath);
    return {
      relativePath,
      originalName: relativePath.split("/").pop()?.replace(/\.png$/i, "") ?? relativePath,
      width: 0,
      height: 0,
      sourceW: 0,
      sourceH: 0,
      autoTrimRect: null,
      hasMetadata: true,
      include: entry.include !== false,
      exportName: entry.nameOverride ?? relativePath.split("/").pop()?.replace(/\.png$/i, "") ?? relativePath,
      nameOverride: entry.nameOverride,
      pivotX: entry.pivotX ?? 0.5,
      pivotY: entry.pivotY ?? 0.5,
      tags: entry.tags ?? [],
      group: entry.group ?? "",
      order: entry.order,
      trimMode: entry.trimMode ?? "default",
      crop: entry.crop,
      cropValid: false,
      validationMessage: "Source PNG is missing from the input folder.",
      status: "missing"
    };
  });
}

export function validateSpriteCropRect(
  crop: SpriteCropRect | undefined,
  sourceW: number,
  sourceH: number
): GuiValidationResult {
  const errors: string[] = [];

  if (!crop) {
    errors.push("Crop rect is required.");
  } else {
    if (!Number.isInteger(crop.x) || crop.x < 0) {
      errors.push("Crop x must be a non-negative integer.");
    }

    if (!Number.isInteger(crop.y) || crop.y < 0) {
      errors.push("Crop y must be a non-negative integer.");
    }

    if (!Number.isInteger(crop.w) || crop.w <= 0) {
      errors.push("Crop width must be a positive integer.");
    }

    if (!Number.isInteger(crop.h) || crop.h <= 0) {
      errors.push("Crop height must be a positive integer.");
    }

    if (Number.isInteger(crop.x) && Number.isInteger(crop.w) && crop.x + crop.w > sourceW) {
      errors.push("Crop width extends beyond the source image.");
    }

    if (Number.isInteger(crop.y) && Number.isInteger(crop.h) && crop.y + crop.h > sourceH) {
      errors.push("Crop height extends beyond the source image.");
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function clampPivotValue(value: number): number {
  if (!Number.isFinite(value)) {
    return 0.5;
  }

  return Math.min(1, Math.max(0, value));
}

export function calculatePivotFromStagePoint(
  sprite: GuiAtlasJsonSprite,
  page: GuiAtlasJsonPage,
  stageX: number,
  stageY: number,
  stageWidth: number,
  stageHeight: number
): { pivotX: number; pivotY: number } {
  const atlasX = stageWidth > 0 ? (stageX / stageWidth) * page.width : sprite.x + sprite.w * sprite.pivotX;
  const atlasY = stageHeight > 0 ? (stageY / stageHeight) * page.height : sprite.y + sprite.h * sprite.pivotY;

  return {
    pivotX: clampPivotValue((atlasX - sprite.x) / sprite.w),
    pivotY: clampPivotValue((atlasY - sprite.y) / sprite.h)
  };
}

export function calculatePivotPreviewPoint(
  sprite: GuiAtlasJsonSprite,
  zoom: number
): { left: number; top: number } {
  const scale = typeof zoom === "number" && Number.isFinite(zoom) && zoom > 0 ? zoom : 1;

  return {
    left: (sprite.x + sprite.w * sprite.pivotX) * scale,
    top: (sprite.y + sprite.h * sprite.pivotY) * scale
  };
}

export function getPreviewPageImages(json: GuiAtlasJson): string[] {
  return json.pages.map((page) => page.image);
}

function normalizePositiveInteger(value: unknown, fallback: number): number {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : fallback;
}

function normalizeNonNegativeInteger(value: unknown, fallback: number): number {
  return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : fallback;
}

function normalizeMaxSize(value: unknown, fallback: number): number {
  return Number.isInteger(value) && ALLOWED_MAX_SIZES.has(Number(value)) ? Number(value) : fallback;
}

function normalizePreviewZoom(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0.25 && value <= 8 ? value : fallback;
}

function normalizeRecentProjectPaths(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const paths: string[] = [];

  for (const item of value) {
    if (typeof item !== "string" || !item.trim()) {
      continue;
    }

    const key = item.toLowerCase();

    if (!seen.has(key)) {
      seen.add(key);
      paths.push(item);
    }

    if (paths.length >= 10) {
      break;
    }
  }

  return paths;
}

function isEmptySpriteMetadataEntry(entry: SpriteMetadataEntry): boolean {
  return entry.include === undefined &&
    (entry.nameOverride === undefined || entry.nameOverride.length === 0) &&
    entry.pivotX === undefined &&
    entry.pivotY === undefined &&
    (!entry.tags || entry.tags.length === 0) &&
    (!entry.group || entry.group.length === 0) &&
    entry.order === undefined &&
    (entry.trimMode === undefined || entry.trimMode === "default") &&
    entry.crop === undefined;
}

function compareInputSprites(a: GuiInputSpriteScanItem, b: GuiInputSpriteScanItem, sortBy: InputSpriteSortKey): number {
  if (sortBy === "source") {
    return a.relativePath.localeCompare(b.relativePath);
  }

  if (sortBy === "export") {
    return a.exportName.localeCompare(b.exportName) || a.relativePath.localeCompare(b.relativePath);
  }

  if (sortBy === "group") {
    return a.group.localeCompare(b.group) || a.relativePath.localeCompare(b.relativePath);
  }

  if (sortBy === "include") {
    return Number(b.include) - Number(a.include) || a.relativePath.localeCompare(b.relativePath);
  }

  if (sortBy === "trim") {
    return a.trimMode.localeCompare(b.trimMode) || a.relativePath.localeCompare(b.relativePath);
  }

  if (sortBy === "invalid") {
    const aInvalid = a.status === "invalid" || a.status === "missing";
    const bInvalid = b.status === "invalid" || b.status === "missing";
    return Number(bInvalid) - Number(aInvalid) || a.relativePath.localeCompare(b.relativePath);
  }

  const aOrder = a.order ?? Number.POSITIVE_INFINITY;
  const bOrder = b.order ?? Number.POSITIVE_INFINITY;
  return aOrder - bOrder || a.relativePath.localeCompare(b.relativePath);
}

function normalizeTags(tags: string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const tag of tags) {
    const trimmed = tag.trim();
    const key = trimmed.toLowerCase();

    if (!trimmed || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(trimmed);
  }

  return result;
}
