import type { PackingAlgorithm } from "./packing.js";
import type { SizeMode } from "./sizeMode.js";
import type { GuiLayoutSettings, RightPanelTab } from "./gui-layout.js";
import type { AppLanguage } from "./i18n/types.js";
import type { ExportValidationResult } from "../core/validation/exportValidation.js";
import type {
  GuiBatchSet,
  GuiBatchSetLoadResult,
  GuiBatchSetRunRequest,
  GuiBatchSetSaveRequest,
  GuiBatchSetSaveResult
} from "./batch-set.js";
import type { SpriteCropRect, SpriteMetadataMap, SpriteTrimMode } from "../core/metadata/metadataTypes.js";

export type { SpriteCropRect, SpriteMetadataEntry, SpriteTrimMode } from "../core/metadata/metadataTypes.js";
export type { AppLanguage } from "./i18n/types.js";
export type { GuiLayoutSettings, RightPanelTab } from "./gui-layout.js";
export type {
  GuiBatchSet,
  GuiBatchSetLoadResult,
  GuiBatchSetRunRequest,
  GuiBatchSetSaveRequest,
  GuiBatchSetSaveResult
} from "./batch-set.js";

export type GuiProfileId = "generic" | "unity" | "monogame";
export type GuiRecentItemKind = "projects" | "inputDirs" | "outputDirs";

export interface GuiExportOptions {
  inputDir: string;
  outputDir: string;
  name: string;
  maxSize: number;
  padding: number;
  trim: boolean;
  extrude: number;
  rotate: boolean;
  clean: boolean;
  algorithm: PackingAlgorithm;
  sizeMode: SizeMode;
  cache: boolean;
  watch: boolean;
  profile: GuiProfileId;
  spriteMetadata: SpriteMetadataMap;
}

export interface GuiSettings extends GuiExportOptions {
  lastProjectPath: string | null;
  recentProjectPaths: string[];
  recentInputDirs: string[];
  recentOutputDirs: string[];
  previewZoom: number;
  windowWidth: number;
  windowHeight: number;
  language: AppLanguage;
  layout: GuiLayoutSettings;
  advancedCollapsed: boolean;
  logCollapsed: boolean;
  rightPanelTab: RightPanelTab;
  useRecommendedSettings: boolean;
}

export interface GuiProjectOptions {
  maxSize: number;
  padding: number;
  trim: boolean;
  extrude: number;
  rotate: boolean;
  clean: boolean;
  algorithm: PackingAlgorithm;
  sizeMode: SizeMode;
  cache: boolean;
  watch: boolean;
}

export interface GuiProjectFile {
  version: 1;
  name: string;
  inputDir: string;
  outputDir: string;
  options: GuiProjectOptions;
  profile: GuiProfileId;
  sprites: SpriteMetadataMap;
}

export interface GuiProjectLoadResult {
  path: string;
  project: GuiProjectFile;
  warnings: string[];
}

export interface GuiProjectSaveRequest {
  path?: string | null;
  project: GuiProjectFile;
}

export interface GuiProjectSaveResult {
  path: string;
  project: GuiProjectFile;
}

export interface GuiProfilePreset {
  id: GuiProfileId;
  label: string;
  description: string;
  options: GuiProjectOptions;
}

export interface GuiValidationResult {
  valid: boolean;
  errors: string[];
}

export interface GuiAtlasPagePreview {
  image: string;
  width: number;
  height: number;
  filePath: string;
  url: string;
}

export interface GuiExportResult {
  spriteCount: number;
  pngPaths: string[];
  jsonPath: string;
  logPath: string;
  metadataPath?: string;
  outputDir: string;
  elapsedMs: number;
  previewPages: GuiAtlasPagePreview[];
  warnings: string[];
  validation: ExportValidationResult;
  metadata: {
    excludedSprites: number;
    renamedSprites: number;
    pivotOverrideSprites: number;
    taggedSprites: number;
    groupedSprites: number;
    orderedSprites: number;
    trimModeOverrideSprites: number;
    manualCropSprites: number;
  };
}

export interface GuiBatchProjectResult {
  projectPath: string;
  success: boolean;
  spriteCount?: number;
  pageCount?: number;
  outputDir?: string;
  jsonPath?: string;
  logPath?: string;
  metadataPath?: string;
  excludedSprites?: number;
  renamedSprites?: number;
  manualCropSprites?: number;
  error?: string;
}

export interface GuiBatchExportResult {
  total: number;
  succeeded: number;
  failed: number;
  results: GuiBatchProjectResult[];
}

export interface GuiBatchExportOptions {
  cacheOverride?: boolean;
  failFast?: boolean;
}

export type GuiWatchEventKind = "started" | "stopped" | "file-event" | "queued" | "running" | "success" | "error";

export interface GuiWatchEvent {
  kind: GuiWatchEventKind;
  message: string;
  at: string;
  reason?: string;
  result?: GuiExportResult;
  error?: string;
}

export interface GuiAtlasJsonPage {
  image: string;
  width: number;
  height: number;
}

export interface GuiAtlasJsonSprite {
  name: string;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  rotated: boolean;
  trimmed: boolean;
  sourceW: number;
  sourceH: number;
  offsetX: number;
  offsetY: number;
  pivotX: number;
  pivotY: number;
}

export interface GuiAtlasJson {
  version: 1;
  name: string;
  pages: GuiAtlasJsonPage[];
  sprites: GuiAtlasJsonSprite[];
}

export interface GuiInputSpriteScanItem {
  relativePath: string;
  originalName: string;
  width: number;
  height: number;
  sourceW: number;
  sourceH: number;
  autoTrimRect: SpriteCropRect | null;
  hasMetadata: boolean;
  include: boolean;
  exportName: string;
  nameOverride?: string;
  pivotX: number;
  pivotY: number;
  tags: string[];
  group: string;
  order?: number;
  trimMode: SpriteTrimMode;
  crop?: SpriteCropRect;
  cropValid: boolean;
  validationMessage?: string;
  status: "included" | "excluded" | "renamed" | "metadata" | "manual-crop" | "invalid" | "missing";
}

export interface GuiSourceImagePreview {
  relativePath: string;
  width: number;
  height: number;
  url: string;
}

export interface GuiSourcePreviewRequest {
  inputDir: string;
  relativePath: string;
}

export interface GuiRecentPathItem {
  path: string;
  exists: boolean;
}

export interface GuiRecentItems {
  projects: GuiRecentPathItem[];
  inputDirs: GuiRecentPathItem[];
  outputDirs: GuiRecentPathItem[];
}

export interface GuiCropValidationRequest {
  sourceW: number;
  sourceH: number;
  crop?: SpriteCropRect;
}

export interface SuwolAtlasGuiApi {
  selectInputDirectory(): Promise<string | null>;
  selectOutputDirectory(): Promise<string | null>;
  exportAtlas(options: GuiExportOptions): Promise<GuiExportResult>;
  scanInput(options: GuiExportOptions): Promise<GuiInputSpriteScanItem[]>;
  getSourceImagePreview(request: GuiSourcePreviewRequest): Promise<GuiSourceImagePreview>;
  computeAutoTrimRect(request: GuiSourcePreviewRequest): Promise<SpriteCropRect | null>;
  validateSpriteCrop(request: GuiCropValidationRequest): Promise<GuiValidationResult>;
  readJson(path: string): Promise<GuiAtlasJson>;
  readLog(path: string): Promise<string>;
  openOutputDirectory(path: string): Promise<void>;
  selectBatchTargets(): Promise<string[] | null>;
  runBatchExport(paths: string[], options?: GuiBatchExportOptions): Promise<GuiBatchExportResult>;
  openBatchSetDialog(): Promise<GuiBatchSetLoadResult | null>;
  saveBatchSet(request: GuiBatchSetSaveRequest): Promise<GuiBatchSetSaveResult>;
  saveBatchSetAs(request: GuiBatchSetSaveRequest): Promise<GuiBatchSetSaveResult | null>;
  runBatchSet(request: GuiBatchSetRunRequest): Promise<GuiBatchExportResult>;
  startWatch(options: GuiExportOptions): Promise<void>;
  stopWatch(): Promise<void>;
  loadSettings(): Promise<GuiSettings>;
  saveSettings(settings: GuiSettings): Promise<void>;
  newProject(): Promise<GuiProjectFile>;
  openProjectDialog(): Promise<GuiProjectLoadResult | null>;
  saveProject(request: GuiProjectSaveRequest): Promise<GuiProjectSaveResult>;
  saveProjectAs(request: GuiProjectSaveRequest): Promise<GuiProjectSaveResult | null>;
  loadProjectFromPath(path: string): Promise<GuiProjectLoadResult>;
  openSampleProject(): Promise<GuiProjectLoadResult>;
  listRecentProjects(): Promise<string[]>;
  listRecentItems(): Promise<GuiRecentItems>;
  cleanRecentItems(kind?: GuiRecentItemKind): Promise<GuiRecentItems>;
  clearRecentItems(kind?: GuiRecentItemKind): Promise<GuiRecentItems>;
  clearAtlasCaches(paths: string[]): Promise<{ deleted: number; paths: string[] }>;
  openRecentProject(path: string): Promise<GuiProjectLoadResult>;
  getVersion(): Promise<string>;
  getLanguage(): Promise<AppLanguage>;
  setLanguage(language: AppLanguage): Promise<void>;
  rebuildMenu(): Promise<void>;
  onMenuCommand(callback: (command: string) => void): () => void;
  onWatchEvent(callback: (event: GuiWatchEvent) => void): () => void;
}
