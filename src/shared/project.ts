import type {
  GuiAtlasJsonPage,
  GuiAtlasJsonSprite,
  GuiProfileId,
  GuiProfilePreset,
  GuiProjectFile,
  GuiProjectOptions,
  GuiSettings
} from "./gui-types.js";
import {
  ALLOWED_MAX_SIZES,
  DEFAULT_GUI_SETTINGS,
  normalizeGuiSettings,
  normalizeProfile,
  normalizeSpriteMetadataMapForGui
} from "./gui-utils.js";
import { normalizePackingAlgorithm } from "./packing.js";
import { normalizeSizeMode } from "./sizeMode.js";

export const PROJECT_FILE_VERSION = 1;
export const PROJECT_FILE_EXTENSION = ".suwol-atlas.json";
export const MAX_RECENT_PROJECTS = 10;

export const PROFILE_PRESETS: GuiProfilePreset[] = [
  {
    id: "generic",
    label: "Generic",
    description: "MaxRects with tight sizing, trim, and a small extrude value for general game atlas exports.",
    options: {
      maxSize: 2048,
      padding: 2,
      trim: true,
      extrude: 1,
      rotate: false,
      clean: true,
      algorithm: "maxrects",
      sizeMode: "tight",
      cache: false,
      watch: false
    }
  },
  {
    id: "unity",
    label: "Unity",
    description: "MaxRects with power-of-two sizing, cache, trim, extrude, and rotate for Unity runtime loading.",
    options: {
      maxSize: 2048,
      padding: 2,
      trim: true,
      extrude: 1,
      rotate: true,
      clean: true,
      algorithm: "maxrects",
      sizeMode: "pot",
      cache: true,
      watch: false
    }
  },
  {
    id: "monogame",
    label: "MonoGame",
    description: "MaxRects with power-of-two sizing and cache; rotation stays off by default for simpler custom draw paths.",
    options: {
      maxSize: 2048,
      padding: 2,
      trim: true,
      extrude: 1,
      rotate: false,
      clean: true,
      algorithm: "maxrects",
      sizeMode: "pot",
      cache: true,
      watch: false
    }
  }
];

export function getProfilePreset(profile: GuiProfileId): GuiProfilePreset {
  return PROFILE_PRESETS.find((preset) => preset.id === profile) ?? PROFILE_PRESETS[0];
}

export function applyProfilePreset(settings: GuiSettings, profile: GuiProfileId): GuiSettings {
  const preset = getProfilePreset(profile);

  return normalizeGuiSettings({
    ...settings,
    ...preset.options,
    profile
  });
}

export function createProjectFile(settings: GuiSettings): GuiProjectFile {
  return normalizeProjectFile({
    version: PROJECT_FILE_VERSION,
    name: settings.name,
    inputDir: settings.inputDir,
    outputDir: settings.outputDir,
    options: {
      maxSize: settings.maxSize,
      padding: settings.padding,
      trim: settings.trim,
      extrude: settings.extrude,
      rotate: settings.rotate,
      clean: settings.clean,
      algorithm: settings.algorithm,
      sizeMode: settings.sizeMode,
      cache: settings.cache,
      watch: settings.watch
    },
    profile: settings.profile,
    sprites: settings.spriteMetadata
  }).project;
}

export function projectToSettings(project: GuiProjectFile, current: GuiSettings = DEFAULT_GUI_SETTINGS): GuiSettings {
  return normalizeGuiSettings({
    ...current,
    inputDir: project.inputDir,
    outputDir: project.outputDir,
    name: project.name,
    maxSize: project.options.maxSize,
    padding: project.options.padding,
    trim: project.options.trim,
    extrude: project.options.extrude,
    rotate: project.options.rotate,
    clean: project.options.clean,
    algorithm: project.options.algorithm,
    sizeMode: project.options.sizeMode,
    cache: project.options.cache,
    watch: project.options.watch,
    profile: project.profile,
    spriteMetadata: project.sprites
  });
}

export function normalizeProjectFile(value: unknown): { project: GuiProjectFile; warnings: string[] } {
  const warnings: string[] = [];

  if (!value || typeof value !== "object") {
    throw new Error("Project file must contain a JSON object.");
  }

  const source = value as Partial<GuiProjectFile>;

  if (source.version !== PROJECT_FILE_VERSION) {
    warnings.push("Project file version was missing or unsupported; version 1 was assumed.");
  }

  const options = normalizeProjectOptions(source.options, warnings);
  const name = typeof source.name === "string" && source.name.trim()
    ? source.name.trim()
    : DEFAULT_GUI_SETTINGS.name;

  if (!source.name) {
    warnings.push("Project name was missing; the default atlas name was used.");
  }

  return {
    project: {
      version: PROJECT_FILE_VERSION,
      name,
      inputDir: typeof source.inputDir === "string" ? source.inputDir : "",
      outputDir: typeof source.outputDir === "string" ? source.outputDir : "",
      options,
      profile: normalizeProfile(source.profile),
      sprites: normalizeSpriteMetadataMapForGui(source.sprites)
    },
    warnings
  };
}

export function addRecentProjectPath(recentProjectPaths: string[], projectPath: string): string[] {
  return addRecentPath(recentProjectPaths, projectPath);
}

export function removeRecentProjectPath(recentProjectPaths: string[], projectPath: string): string[] {
  return removeRecentPath(recentProjectPaths, projectPath);
}

export function addRecentPath(recentPaths: string[], nextPath: string): string[] {
  const trimmed = nextPath.trim();

  if (!trimmed) {
    return recentPaths.slice(0, MAX_RECENT_PROJECTS);
  }

  const key = trimmed.toLowerCase();
  const next = [
    trimmed,
    ...recentPaths.filter((item) => item.toLowerCase() !== key)
  ];

  return next.slice(0, MAX_RECENT_PROJECTS);
}

export function removeRecentPath(recentPaths: string[], itemPath: string): string[] {
  const key = itemPath.toLowerCase();
  return recentPaths.filter((item) => item.toLowerCase() !== key).slice(0, MAX_RECENT_PROJECTS);
}

export function isProjectDirty(settings: GuiSettings, savedProject: GuiProjectFile | null): boolean {
  if (!savedProject) {
    return false;
  }

  return stableStringifyProject(createProjectFile(settings)) !== stableStringifyProject(savedProject);
}

export interface PreviewRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function calculateSpritePreviewRect(
  sprite: GuiAtlasJsonSprite,
  page: GuiAtlasJsonPage,
  selectedPageIndex: number,
  zoom: number
): PreviewRect | null {
  if (sprite.page !== selectedPageIndex) {
    return null;
  }

  const scale = typeof zoom === "number" && Number.isFinite(zoom) && zoom > 0 ? zoom : 1;

  return {
    left: sprite.x * scale,
    top: sprite.y * scale,
    width: Math.min(sprite.w, page.width - sprite.x) * scale,
    height: Math.min(sprite.h, page.height - sprite.y) * scale
  };
}

function normalizeProjectOptions(value: unknown, warnings: string[]): GuiProjectOptions {
  const source = value && typeof value === "object" ? value as Partial<GuiProjectOptions> : {};

  if (!value || typeof value !== "object") {
    warnings.push("Project options were missing; default export options were used.");
  }

  return {
    maxSize: Number.isInteger(source.maxSize) && ALLOWED_MAX_SIZES.has(Number(source.maxSize))
      ? Number(source.maxSize)
      : DEFAULT_GUI_SETTINGS.maxSize,
    padding: normalizeNonNegativeInteger(source.padding, DEFAULT_GUI_SETTINGS.padding),
    trim: Boolean(source.trim),
    extrude: normalizeNonNegativeInteger(source.extrude, DEFAULT_GUI_SETTINGS.extrude),
    rotate: Boolean(source.rotate),
    clean: source.clean === undefined ? DEFAULT_GUI_SETTINGS.clean : Boolean(source.clean),
    algorithm: normalizePackingAlgorithm(source.algorithm),
    sizeMode: normalizeSizeMode(source.sizeMode),
    cache: source.cache === undefined ? DEFAULT_GUI_SETTINGS.cache : Boolean(source.cache),
    watch: source.watch === undefined ? DEFAULT_GUI_SETTINGS.watch : Boolean(source.watch)
  };
}

function normalizeNonNegativeInteger(value: unknown, fallback: number): number {
  return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : fallback;
}

function stableStringifyProject(project: GuiProjectFile): string {
  return JSON.stringify({
    version: PROJECT_FILE_VERSION,
    name: project.name,
    inputDir: project.inputDir,
    outputDir: project.outputDir,
    options: {
      maxSize: project.options.maxSize,
      padding: project.options.padding,
      trim: project.options.trim,
      extrude: project.options.extrude,
      rotate: project.options.rotate,
      clean: project.options.clean,
      algorithm: project.options.algorithm,
      sizeMode: project.options.sizeMode,
      cache: project.options.cache,
      watch: project.options.watch
    },
    profile: project.profile,
    sprites: normalizeSpriteMetadataMapForGui(project.sprites)
  });
}
