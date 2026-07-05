import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { PNG } from "pngjs";
import { parseNonNegativeInteger, parsePackingAlgorithmOption, parseSizeModeOption } from "../src/cli/options.js";
import { batchExport } from "../src/core/batch/batchExport.js";
import { getCachePath } from "../src/core/cache/cacheStore.js";
import { buildAtlasJson } from "../src/core/exporters/jsonExporter.js";
import { buildMetadataSidecarJson } from "../src/core/exporters/metadataExporter.js";
import { writeAtlasPng, writeAtlasPngs } from "../src/core/exporters/pngExporter.js";
import { loadPngImages, listPngFiles } from "../src/core/image/pngLoader.js";
import { prepareImages } from "../src/core/image/preprocess.js";
import type { LoadedImage } from "../src/core/image/types.js";
import type { SpriteMetadataMap } from "../src/core/metadata/metadataTypes.js";
import type { GuiInputSpriteScanItem } from "../src/shared/gui-types.js";
import { makeAtlas } from "../src/core/makeAtlas.js";
import { resolveSpriteMetadata } from "../src/core/metadata/metadataResolver.js";
import { normalizeMetadataPathKey, validateAndResolveSpriteMetadata } from "../src/core/metadata/spriteMetadata.js";
import { packSprites as packWithFactory, createPacker, parsePackingAlgorithm } from "../src/core/packer/packerFactory.js";
import { packSprites } from "../src/core/packer/shelfPacker.js";
import type { PackOptions, PackResult } from "../src/core/packer/types.js";
import { resolvePageSize } from "../src/core/sizing/sizeMode.js";
import { DebouncedExportQueue } from "../src/core/watch/watchAtlas.js";
import { validateExportResult } from "../src/core/validation/exportValidation.js";
import {
  DEFAULT_GUI_SETTINGS,
  addTagsForSprites,
  assignSequentialOrderForSprites,
  buildExportResultSummary,
  calculatePivotFromStagePoint,
  calculatePivotPreviewPoint,
  classifyGuiError,
  clearNameOverrides,
  clearTagsAndGroups,
  createMissingMetadataScanItems,
  excludeSprites,
  filterAndSortInputSprites,
  filterSprites,
  formatElapsedMs,
  getMissingSpriteMetadataPaths,
  getPreviewPageImages,
  includeAllSprites,
  normalizeGuiSettings,
  removeMissingSpriteMetadata,
  removeTagsForSprites,
  reorderInputSpriteOrder,
  reorderVisibleInputSpriteOrder,
  resetCropForSprites,
  resetPivotForSprites,
  resetSpriteOrder,
  resetSpriteMetadataEntries,
  setGroupForSprites,
  setIncludeForSprites,
  setSpriteMetadataEntry,
  validateSpriteCropRect,
  toCoreMakeAtlasOptions,
  validateGuiExportOptions
} from "../src/shared/gui-utils.js";
import { getErrorGuide, getErrorGuideCodes } from "../src/shared/error-guide.js";
import { buildExportValidationDisplay, formatExportValidationLog } from "../src/shared/export-result.js";
import {
  BATCH_SET_FILE_EXTENSION,
  createBatchSet,
  ensureBatchSetExtension,
  normalizeBatchSet
} from "../src/shared/batch-set.js";
import {
  calculatePivotFromCropPoint,
  calculatePivotPointInCrop,
  centerCropRect,
  clampCropRect,
  moveCropRect,
  resizeCropRect,
  sourcePointFromPreviewPoint
} from "../src/shared/crop-editing.js";
import {
  canRedoEditorHistory,
  canUndoEditorHistory,
  createEditorHistory,
  isEditorHistoryDirty,
  markEditorHistorySaved,
  pushEditorHistory,
  redoEditorHistory,
  resetEditorHistory,
  undoEditorHistory
} from "../src/shared/history.js";
import { resolveInputRelativePath } from "../src/shared/source-preview-security.js";
import {
  DEFAULT_GUI_LAYOUT,
  GUI_LAYOUT_LIMITS,
  getPreviewEmptyAction,
  getPreviewEmptyReason,
  normalizeGuiLayoutSettings,
  normalizeRightPanelTab
} from "../src/shared/gui-layout.js";
import { I18N_NAMESPACES } from "../src/shared/i18n/types.js";
import { normalizeAppLanguage, resolveAppLanguage } from "../src/shared/i18n/language.js";
import { getEnabledLocaleIds, languageOptions } from "../src/shared/i18n/language-registry.js";
import { getLocaleNamespaceFileNames, hasCompleteLocaleNamespaceSet } from "../src/shared/i18n/locale-loader.js";
import { getMenuLabels } from "../src/shared/i18n/menu.js";
import {
  addRecentProjectPath,
  addRecentPath,
  applyProfilePreset,
  calculateSpritePreviewRect,
  createProjectFile,
  isProjectDirty,
  normalizeProjectFile,
  PROFILE_PRESETS,
  projectToSettings
} from "../src/shared/project.js";

type Color = [number, number, number, number];

describe("PNG loading", () => {
  it("reads PNG files recursively and ignores other files", async () => {
    const dir = await createTempDir();
    await writeTestPng(path.join(dir, "a.png"), 2, 2, [255, 0, 0, 255]);
    await fs.mkdir(path.join(dir, "nested"));
    await writeTestPng(path.join(dir, "nested", "b.PNG"), 2, 2, [0, 255, 0, 255]);
    await fs.writeFile(path.join(dir, "notes.txt"), "ignore me", "utf8");

    const files = await listPngFiles(dir);

    expect(files.map((file) => path.basename(file)).sort()).toEqual(["a.png", "b.PNG"]);
  });

  it("throws a clear error for an empty input folder", async () => {
    const dir = await createTempDir();

    await expect(loadPngImages(dir)).rejects.toThrow(/No PNG files found/);
  });

  it("allows duplicate file stems during loading so metadata can resolve final names", async () => {
    const dir = await createTempDir();
    await fs.mkdir(path.join(dir, "a"));
    await fs.mkdir(path.join(dir, "b"));
    await writeTestPng(path.join(dir, "a", "hero.png"), 2, 2, [255, 0, 0, 255]);
    await writeTestPng(path.join(dir, "b", "hero.png"), 2, 2, [0, 255, 0, 255]);

    const images = await loadPngImages(dir);

    expect(images.map((image) => image.filePath.replace(/\\/g, "/"))).toEqual([
      expect.stringContaining("/a/hero.png"),
      expect.stringContaining("/b/hero.png")
    ]);
  });
});

describe("image preprocessing", () => {
  it("keeps the original image when trim is disabled", () => {
    const image = createLoadedImage("bordered", makeTransparentBorderPng(8, 6, 2, 1, 3, 2));

    const [sprite] = prepareImages([image], { trim: false });

    expect(sprite).toMatchObject({
      sourceW: 8,
      sourceH: 6,
      contentW: 8,
      contentH: 6,
      offsetX: 0,
      offsetY: 0,
      trimmed: false
    });
  });

  it("trims transparent bounds and records offsets", () => {
    const image = createLoadedImage("trimmed", makeTransparentBorderPng(10, 8, 2, 3, 4, 2));

    const [sprite] = prepareImages([image], { trim: true });
    const result = packSprites([sprite], defaultPackOptions());
    const json = buildAtlasJson("atlas", result);

    expect(sprite).toMatchObject({
      sourceW: 10,
      sourceH: 8,
      contentW: 4,
      contentH: 2,
      offsetX: 2,
      offsetY: 3,
      trimmed: true
    });
    expect(json.sprites[0]).toMatchObject({
      w: 4,
      h: 2,
      offsetX: 2,
      offsetY: 3,
      trimmed: true
    });
  });

  it("exports a fully transparent trimmed image as a 1x1 transparent sprite", async () => {
    const inputDir = await createTempDir();
    const outputDir = await createTempDir();
    await writeTestPng(path.join(inputDir, "empty.png"), 6, 5, [0, 0, 0, 0]);

    const result = await makeAtlas(inputDir, outputDir, {
      name: "transparent",
      maxSize: 32,
      padding: 0,
      format: "json",
      clean: true,
      trim: true
    });
    const json = JSON.parse(await fs.readFile(result.files.json, "utf8"));
    const atlas = PNG.sync.read(await fs.readFile(result.files.png));

    expect(json.sprites[0]).toMatchObject({
      sourceW: 6,
      sourceH: 5,
      w: 1,
      h: 1,
      offsetX: 0,
      offsetY: 0,
      trimmed: true
    });
    expect(readPixel(atlas, json.sprites[0].x, json.sprites[0].y)).toEqual([0, 0, 0, 0]);
  });
});

describe("sprite metadata", () => {
  it("migrates project files without sprite metadata to an empty metadata map", () => {
    const { project } = normalizeProjectFile({
      version: 1,
      name: "legacy_project",
      inputDir: "input",
      outputDir: "output",
      profile: "generic",
      options: {
        maxSize: 2048,
        padding: 2,
        trim: false,
        extrude: 0,
        rotate: false,
        clean: true,
        algorithm: "shelf",
        sizeMode: "tight",
        cache: false,
        watch: false
      }
    });

    expect(project.sprites).toEqual({});
    expect(validateAndResolveSpriteMetadata(undefined, "hero.png")).toMatchObject({
      include: true,
      pivotX: 0.5,
      pivotY: 0.5,
      tags: [],
      group: "",
      trimMode: "default"
    });
  });

  it("validates pivot, name override, order, trim mode, crop, and tag normalization", () => {
    expect(() => validateAndResolveSpriteMetadata({ pivotX: 1.2 }, "hero.png")).toThrow(/pivotX/);
    expect(() => validateAndResolveSpriteMetadata({ nameOverride: "bad/name" }, "hero.png")).toThrow(/forbidden/);
    expect(() => validateAndResolveSpriteMetadata({ nameOverride: "" }, "hero.png")).toThrow(/must not be empty/);
    expect(() => validateAndResolveSpriteMetadata({ order: -1 }, "hero.png")).toThrow(/order/);
    expect(() => validateAndResolveSpriteMetadata({ trimMode: "crop" as never }, "hero.png")).toThrow(/trimMode/);
    expect(() => validateAndResolveSpriteMetadata({ trimMode: "manual" }, "hero.png", 8, 8)).toThrow(/crop is required/);
    expect(() => validateAndResolveSpriteMetadata({
      trimMode: "manual",
      crop: { x: 5, y: 0, w: 4, h: 4 }
    }, "hero.png", 8, 8)).toThrow(/bounds/);

    expect(validateAndResolveSpriteMetadata({
      tags: [" hero ", "", "idle", "Hero"],
      group: " hero ",
      order: 2,
      trimMode: "manual",
      crop: { x: 1, y: 2, w: 3, h: 4 }
    }, "hero.png")).toMatchObject({
      tags: ["hero", "idle"],
      group: "hero",
      order: 2,
      trimMode: "manual",
      crop: { x: 1, y: 2, w: 3, h: 4 }
    });
  });

  it("normalizes relative metadata keys and resolves include, name, and pivot overrides", () => {
    const first = createLoadedImage("idle_0", makeSolidPng(2, 2, [255, 0, 0, 255]));
    const second = createLoadedImage("idle_1", makeSolidPng(2, 2, [0, 255, 0, 255]));
    const hidden = createLoadedImage("unused", makeSolidPng(2, 2, [0, 0, 255, 255]));
    first.filePath = path.join("memory", "characters", "hero", "idle_0.png");
    second.filePath = path.join("memory", "characters", "hero", "idle_1.png");
    hidden.filePath = path.join("memory", "characters", "hero", "unused.png");

    const result = resolveSpriteMetadata([first, second, hidden], "memory", {
      [normalizeMetadataPathKey("characters\\hero\\idle_0.png")]: {
        nameOverride: "hero_idle",
        pivotX: 0.25,
        pivotY: 0.75,
        tags: ["hero"],
        group: "hero"
      },
      "characters/hero/unused.png": {
        include: false
      }
    });

    expect(result.images.map((image) => image.name)).toEqual(["hero_idle", "idle_1"]);
    expect(result.images[0].metadata).toMatchObject({
      sourcePath: "characters/hero/idle_0.png",
      originalName: "idle_0",
      exportName: "hero_idle",
      pivotX: 0.25,
      pivotY: 0.75
    });
    expect(result.stats).toMatchObject({
      totalInputSprites: 3,
      includedSprites: 2,
      excludedSprites: 1,
      renamedSprites: 1,
      pivotOverrideSprites: 1,
      taggedSprites: 1,
      groupedSprites: 1
    });
  });

  it("rejects duplicate final export names after metadata is applied", () => {
    const first = createLoadedImage("hero", makeSolidPng(2, 2, [255, 0, 0, 255]));
    const second = createLoadedImage("hero", makeSolidPng(2, 2, [0, 255, 0, 255]));
    first.filePath = path.join("memory", "a", "hero.png");
    second.filePath = path.join("memory", "b", "hero.png");

    expect(() => resolveSpriteMetadata([first, second], "memory", {})).toThrow(/Duplicate export sprite name "hero"/);
    expect(() => resolveSpriteMetadata([first, second], "memory", {
      "b/hero.png": {
        include: false
      }
    })).not.toThrow();
  });

  it("applies order and per-sprite trim modes before packing", () => {
    const none = createLoadedImage("none", makeTransparentBorderPng(10, 8, 2, 2, 4, 3));
    const auto = createLoadedImage("auto", makeTransparentBorderPng(10, 8, 2, 2, 4, 3));
    const manual = createLoadedImage("manual", makeTransparentBorderPng(10, 8, 2, 2, 4, 3));
    none.filePath = path.join("memory", "none.png");
    auto.filePath = path.join("memory", "auto.png");
    manual.filePath = path.join("memory", "manual.png");

    const result = resolveSpriteMetadata([none, auto, manual], "memory", {
      "none.png": { order: 20, trimMode: "none" },
      "auto.png": { order: 10, trimMode: "auto" },
      "manual.png": {
        order: 0,
        trimMode: "manual",
        crop: { x: 1, y: 1, w: 5, h: 4 }
      }
    });
    const sprites = prepareImages(result.images, { trim: false });

    expect(result.images.map((image) => image.name)).toEqual(["manual", "auto", "none"]);
    expect(sprites.map((sprite) => sprite.name)).toEqual(["manual", "auto", "none"]);
    expect(sprites[0]).toMatchObject({ contentW: 5, contentH: 4, offsetX: 1, offsetY: 1, trimmed: true });
    expect(sprites[1]).toMatchObject({ contentW: 4, contentH: 3, offsetX: 2, offsetY: 2, trimmed: true });
    expect(sprites[2]).toMatchObject({ contentW: 10, contentH: 8, offsetX: 0, offsetY: 0, trimmed: false });
    expect(result.stats).toMatchObject({
      orderedSprites: 3,
      trimModeOverrideSprites: 3,
      manualCropSprites: 1
    });
  });

  it("keeps metadata sidecar separate from atlas JSON", async () => {
    const inputDir = await createTempDir();
    const outputDir = await createTempDir();
    await fs.mkdir(path.join(inputDir, "characters", "hero"), { recursive: true });
    await writeTestPng(path.join(inputDir, "characters", "hero", "idle_0.png"), 4, 4, [255, 0, 0, 255]);
    await writeTestPng(path.join(inputDir, "unused.png"), 4, 4, [0, 255, 0, 255]);

    const result = await makeAtlas(inputDir, outputDir, {
      name: "metadata_atlas",
      maxSize: 32,
      padding: 1,
      format: "json",
      clean: true,
      spriteMetadata: {
        "characters/hero/idle_0.png": {
          nameOverride: "hero_idle",
          pivotX: 0.5,
          pivotY: 0.85,
          tags: ["hero", "idle"],
          group: "hero"
        },
        "unused.png": {
          include: false
        }
      }
    });
    const atlas = JSON.parse(await fs.readFile(result.files.json, "utf8"));
    const sidecar = JSON.parse(await fs.readFile(result.files.metadata!, "utf8"));

    expect(atlas.version).toBe(1);
    expect(atlas.sprites).toHaveLength(1);
    expect(atlas.sprites[0]).toMatchObject({
      name: "hero_idle",
      pivotX: 0.5,
      pivotY: 0.85
    });
    expect(Object.keys(atlas.sprites[0])).not.toContain("tags");
    expect(Object.keys(atlas.sprites[0])).not.toContain("group");
    expect(Object.keys(atlas.sprites[0])).not.toContain("sourcePath");
    expect(Object.keys(atlas.sprites[0])).not.toContain("metadata");
    expect(sidecar).toMatchObject({
      version: 1,
      atlas: "metadata_atlas",
      sprites: [
        {
          name: "hero_idle",
          sourcePath: "characters/hero/idle_0.png",
          originalName: "idle_0",
          included: true,
          group: "hero",
          tags: ["hero", "idle"],
          pivotX: 0.5,
          pivotY: 0.85
        }
      ]
    });
    expect(result.metadata).toMatchObject({
      excludedSprites: 1,
      renamedSprites: 1,
      taggedSprites: 1,
      groupedSprites: 1
    });
  });

  it("exports manual crop through existing atlas JSON rect fields only", async () => {
    const inputDir = await createTempDir();
    const outputDir = await createTempDir();
    await fs.writeFile(
      path.join(inputDir, "manual.png"),
      PNG.sync.write(makeTransparentBorderPng(12, 10, 3, 2, 5, 4))
    );

    const result = await makeAtlas(inputDir, outputDir, {
      name: "manual_crop",
      maxSize: 32,
      padding: 0,
      format: "json",
      clean: true,
      trim: false,
      spriteMetadata: {
        "manual.png": {
          trimMode: "manual",
          crop: { x: 3, y: 2, w: 5, h: 4 },
          order: 0,
          tags: ["crop"]
        }
      }
    });
    const atlas = JSON.parse(await fs.readFile(result.files.json, "utf8"));
    const sidecar = JSON.parse(await fs.readFile(result.files.metadata!, "utf8"));

    expect(atlas.sprites[0]).toMatchObject({
      w: 5,
      h: 4,
      sourceW: 12,
      sourceH: 10,
      offsetX: 3,
      offsetY: 2,
      trimmed: true
    });
    expect(Object.keys(atlas.sprites[0])).not.toContain("crop");
    expect(Object.keys(atlas.sprites[0])).not.toContain("order");
    expect(Object.keys(atlas.sprites[0])).not.toContain("trimMode");
    expect(sidecar.sprites[0]).toMatchObject({
      order: 0,
      trimMode: "manual",
      crop: { x: 3, y: 2, w: 5, h: 4 }
    });
  });

  it("builds metadata sidecar JSON from packed sprites", () => {
    const image = createLoadedImage("hero", makeSolidPng(2, 2, [255, 0, 0, 255]));
    const resolved = resolveSpriteMetadata([image], "memory", {
      "hero.png": {
        tags: ["hero"],
        group: "characters"
      }
    });
    const packed = packLoadedImages(resolved.images, { maxSize: 16 });
    const sidecar = buildMetadataSidecarJson("sidecar_atlas", packed);

    expect(sidecar).toEqual({
      version: 1,
      atlas: "sidecar_atlas",
      sprites: [
        {
          name: "hero",
          sourcePath: "hero.png",
          originalName: "hero",
          included: true,
          group: "characters",
          tags: ["hero"],
          pivotX: 0.5,
          pivotY: 0.5,
          trimMode: "default"
        }
      ]
    });
  });

  it("supports GUI metadata utility bulk edits and pivot preview calculations", () => {
    const rows = [
      {
        relativePath: "hero.png",
        originalName: "hero",
        width: 4,
        height: 4,
        sourceW: 4,
        sourceH: 4,
        autoTrimRect: { x: 1, y: 1, w: 2, h: 2 },
        hasMetadata: false,
        include: true,
        exportName: "hero",
        pivotX: 0.5,
        pivotY: 0.5,
        tags: [],
        group: "",
        order: 10,
        trimMode: "default" as const,
        cropValid: true,
        status: "included" as const
      }
    ];
    const withOverride = setSpriteMetadataEntry({}, "hero.png", {
      include: false,
      nameOverride: "hero_idle",
      pivotX: 0.25,
      pivotY: 0.75,
      tags: ["hero"],
      group: "characters"
    });

    expect(excludeSprites({}, ["hero.png"])["hero.png"]).toMatchObject({ include: false });
    expect(withOverride["hero.png"]).toMatchObject({ include: false, nameOverride: "hero_idle" });
    expect(includeAllSprites(withOverride, rows)["hero.png"]).toMatchObject({ include: true });
    expect(clearNameOverrides(withOverride)["hero.png"].nameOverride).toBeUndefined();
    expect(clearTagsAndGroups(withOverride)["hero.png"]).not.toHaveProperty("tags");
    expect(clearTagsAndGroups(withOverride)["hero.png"]).not.toHaveProperty("group");
    expect(resetSpriteMetadataEntries(withOverride, ["hero.png"])).toEqual({});
    expect(setGroupForSprites({}, ["hero.png"], "characters")["hero.png"]).toMatchObject({ group: "characters" });
    expect(resetSpriteOrder(setSpriteMetadataEntry({}, "hero.png", { order: 10 }))).toEqual({});
    expect(reorderInputSpriteOrder({}, rows, "hero.png", "top")["hero.png"]).toMatchObject({ order: 0 });
    expect(filterAndSortInputSprites(rows, { query: "hero", include: "included", sortBy: "order" })).toHaveLength(1);
    expect(validateSpriteCropRect({ x: 1, y: 1, w: 2, h: 2 }, 4, 4)).toMatchObject({ valid: true });
    expect(validateSpriteCropRect({ x: 3, y: 0, w: 2, h: 2 }, 4, 4).valid).toBe(false);
    expect(calculatePivotPreviewPoint({
      name: "hero",
      page: 0,
      x: 10,
      y: 20,
      w: 8,
      h: 4,
      rotated: false,
      trimmed: false,
      sourceW: 8,
      sourceH: 4,
      offsetX: 0,
      offsetY: 0,
      pivotX: 0.25,
      pivotY: 0.5
    }, 2)).toEqual({ left: 24, top: 44 });
    expect(calculatePivotFromStagePoint({
      name: "hero",
      page: 0,
      x: 10,
      y: 20,
      w: 8,
      h: 4,
      rotated: false,
      trimmed: false,
      sourceW: 8,
      sourceH: 4,
      offsetX: 0,
      offsetY: 0,
      pivotX: 0.5,
      pivotY: 0.5
    }, { image: "page.png", width: 40, height: 40 }, 14, 22, 40, 40)).toEqual({ pivotX: 0.5, pivotY: 0.5 });
  });

  it("tracks editor history, save baselines, undo, redo, and history limit", () => {
    const serialize = (settings: typeof DEFAULT_GUI_SETTINGS) => JSON.stringify(createProjectFile(settings));
    let history = createEditorHistory(DEFAULT_GUI_SETTINGS, { limit: 2, serialize });

    expect(canUndoEditorHistory(history)).toBe(false);
    expect(isEditorHistoryDirty(history, serialize)).toBe(false);

    const changedPadding = normalizeGuiSettings({ ...DEFAULT_GUI_SETTINGS, padding: 4 });
    history = pushEditorHistory(history, changedPadding, serialize);
    expect(canUndoEditorHistory(history)).toBe(true);
    expect(isEditorHistoryDirty(history, serialize)).toBe(true);

    history = undoEditorHistory(history);
    expect(history.present.padding).toBe(DEFAULT_GUI_SETTINGS.padding);
    expect(canRedoEditorHistory(history)).toBe(true);
    expect(isEditorHistoryDirty(history, serialize)).toBe(false);

    history = redoEditorHistory(history);
    history = markEditorHistorySaved(history, serialize);
    expect(isEditorHistoryDirty(history, serialize)).toBe(false);

    history = pushEditorHistory(history, normalizeGuiSettings({ ...history.present, name: "saved_then_undo" }), serialize);
    expect(isEditorHistoryDirty(history, serialize)).toBe(true);
    history = undoEditorHistory(history);
    expect(isEditorHistoryDirty(history, serialize)).toBe(false);

    history = pushEditorHistory(history, normalizeGuiSettings({ ...history.present, padding: 8 }), serialize);
    history = pushEditorHistory(history, normalizeGuiSettings({ ...history.present, padding: 10 }), serialize);
    history = pushEditorHistory(history, normalizeGuiSettings({ ...history.present, padding: 12 }), serialize);
    expect(history.past).toHaveLength(2);

    history = resetEditorHistory(history, DEFAULT_GUI_SETTINGS, { serialize });
    expect(history.past).toHaveLength(0);
    expect(history.future).toHaveLength(0);
  });

  it("calculates visual crop editing geometry with clamp, resize, min size, zoom, and pivot", () => {
    expect(sourcePointFromPreviewPoint(50, 25, 100, 50, 200, 100)).toEqual({ x: 25, y: 12 });
    expect(clampCropRect({ x: 90, y: 40, w: 40, h: 20 }, 100, 50)).toEqual({ x: 60, y: 30, w: 40, h: 20 });
    expect(moveCropRect({ x: 10, y: 10, w: 20, h: 10 }, 90, 80, 100, 50)).toEqual({ x: 80, y: 40, w: 20, h: 10 });
    expect(resizeCropRect({ x: 10, y: 10, w: 20, h: 10 }, "nw", 30, 20, 100, 50)).toEqual({ x: 40, y: 30, w: 1, h: 1 });
    expect(resizeCropRect({ x: 10, y: 10, w: 20, h: 10 }, "se", 100, 100, 100, 50)).toEqual({ x: 10, y: 10, w: 90, h: 40 });
    expect(centerCropRect(20, 10)).toEqual({ x: 5, y: 2, w: 10, h: 5 });
    expect(calculatePivotFromCropPoint({ x: 4, y: 6, w: 20, h: 10 }, 14, 11)).toEqual({ pivotX: 0.5, pivotY: 0.5 });
    expect(calculatePivotPointInCrop({ x: 4, y: 6, w: 20, h: 10 }, 0.25, 0.75)).toEqual({ x: 9, y: 13.5 });
  });

  it("supports sprite list multi-edit helpers and missing metadata cleanup", () => {
    const rows = [
      makeGuiScanItem("b.png", { order: 20, group: "items", tags: ["coin"], trimMode: "manual", crop: { x: 1, y: 1, w: 2, h: 2 } }),
      makeGuiScanItem("a.png", { order: 10, group: "characters", tags: ["hero"] })
    ];
    let metadata: SpriteMetadataMap = {
      "a.png": { group: "characters", tags: ["hero"], order: 10 },
      "b.png": { trimMode: "manual" as const, crop: { x: 1, y: 1, w: 2, h: 2 }, order: 20 },
      "missing.png": { tags: ["stale"], order: 30 }
    };

    expect(filterAndSortInputSprites(rows, { group: "items", sortBy: "order" }).map((row) => row.relativePath)).toEqual(["b.png"]);
    expect(filterAndSortInputSprites(rows, { hasCrop: true, sortBy: "order" })).toHaveLength(1);
    expect(setIncludeForSprites({}, ["a.png", "b.png"], false)["a.png"]).toMatchObject({ include: false });
    metadata = addTagsForSprites(metadata, ["a.png"], ["selected", "hero"]);
    expect(metadata["a.png"].tags).toEqual(["hero", "selected"]);
    metadata = removeTagsForSprites(metadata, ["a.png"], ["hero"]);
    expect(metadata["a.png"].tags).toEqual(["selected"]);
    metadata = resetCropForSprites(metadata, ["b.png"]);
    expect(metadata["b.png"]).not.toHaveProperty("crop");
    expect(metadata["b.png"].trimMode).toBe("default");
    metadata = resetPivotForSprites(setSpriteMetadataEntry(metadata, "a.png", { ...metadata["a.png"], pivotX: 0.1, pivotY: 0.9 }), ["a.png"]);
    expect(metadata["a.png"]).not.toHaveProperty("pivotX");
    metadata = assignSequentialOrderForSprites(metadata, ["b.png", "a.png"]);
    expect(metadata["b.png"].order).toBe(0);
    expect(metadata["a.png"].order).toBe(10);
    const reordered = reorderVisibleInputSpriteOrder(
      {},
      [
        makeGuiScanItem("a.png", { order: 10 }),
        makeGuiScanItem("b.png", { order: 20 }),
        makeGuiScanItem("c.png", { order: 30 })
      ],
      ["c.png", "a.png"],
      "c.png",
      "a.png"
    );
    expect(reordered["c.png"].order).toBe(0);
    expect(reordered["b.png"].order).toBe(10);
    expect(reordered["a.png"].order).toBe(20);
    expect(getMissingSpriteMetadataPaths(metadata, rows)).toEqual(["missing.png"]);
    expect(createMissingMetadataScanItems(metadata, rows)[0]).toMatchObject({ relativePath: "missing.png", status: "missing" });
    expect(removeMissingSpriteMetadata(metadata, rows)).not.toHaveProperty("missing.png");
  });

  it("validates source preview paths inside the input directory", () => {
    const root = path.resolve("C:/Project/SuwolAtlasMaker/samples/input-ux");

    expect(resolveInputRelativePath(root, "hero/idle.png")).toBe(path.resolve(root, "hero/idle.png"));
    expect(() => resolveInputRelativePath(root, "../secret.png")).toThrow(/inside/);
    expect(() => resolveInputRelativePath(root, "C:/outside.png")).toThrow(/relative/);
    expect(() => resolveInputRelativePath(root, "notes.txt")).toThrow(/PNG/);
  });
});

describe("packing", () => {
  it("throws when an image is larger than max-size", () => {
    const image = createLoadedImage("large", makeSolidPng(9, 4, [255, 0, 0, 255]));
    const [sprite] = prepareImages([image], { trim: false });

    expect(() => packSprites([sprite], defaultPackOptions({ maxSize: 8 }))).toThrow(
      /exceeds max size/
    );
  });

  it("applies padding after the full draw area", () => {
    const first = createLoadedImage("a", makeSolidPng(10, 10, [255, 0, 0, 255]));
    const second = createLoadedImage("b", makeSolidPng(10, 10, [0, 255, 0, 255]));

    const result = packLoadedImages([first, second], { maxSize: 64, padding: 3 });
    const a = result.sprites.find((sprite) => sprite.name === "a");
    const b = result.sprites.find((sprite) => sprite.name === "b");

    expect(a).toBeDefined();
    expect(b).toBeDefined();
    expect(b?.x).toBe((a?.x ?? 0) + 10 + 3);
    expect(b?.y).toBe(a?.y);
  });

  it("returns one packed sprite per input image", () => {
    const images = [
      createLoadedImage("a", makeSolidPng(8, 8, [255, 0, 0, 255])),
      createLoadedImage("b", makeSolidPng(6, 6, [0, 255, 0, 255])),
      createLoadedImage("c", makeSolidPng(4, 4, [0, 0, 255, 255]))
    ];

    const result = packLoadedImages(images, { maxSize: 64, padding: 2 });

    expect(result.sprites).toHaveLength(images.length);
    expect(result.pages).toHaveLength(1);
  });

  it("keeps rotation disabled unless rotate is enabled", () => {
    const image = createLoadedImage("tall", makePatternPng(2, 3));

    const result = packLoadedImages([image], { maxSize: 16, rotate: false });

    expect(result.sprites[0]).toMatchObject({
      rotated: false,
      w: 2,
      h: 3
    });
  });

  it("rotates when the rotated candidate is better and writes rotated pixels", async () => {
    const dir = await createTempDir();
    const image = createLoadedImage("tall", makePatternPng(2, 3));
    const result = packLoadedImages([image], { maxSize: 16, rotate: true });

    const outputPath = await writeAtlasPng(dir, "atlas", result);
    const atlas = PNG.sync.read(await fs.readFile(outputPath));
    const sprite = result.sprites[0];

    expect(sprite).toMatchObject({
      rotated: true,
      w: 3,
      h: 2
    });
    expect(readPixel(atlas, sprite.x, sprite.y)).toEqual([0, 255, 255, 255]);
  });
});

describe("packer factory and MaxRects packing", () => {
  it("selects shelf and maxrects packers and rejects invalid algorithms", () => {
    expect(createPacker("shelf")).toBeDefined();
    expect(createPacker("maxrects")).toBeDefined();
    expect(parsePackingAlgorithm("maxrects")).toBe("maxrects");
    expect(() => parsePackingAlgorithm("unknown")).toThrow(/shelf.*maxrects/);
  });

  it("packs multiple images into one MaxRects page within max-size", () => {
    const images = [
      createLoadedImage("a", makeSolidPng(5, 9, [255, 0, 0, 255])),
      createLoadedImage("b", makeSolidPng(2, 2, [0, 255, 0, 255])),
      createLoadedImage("c", makeSolidPng(2, 2, [0, 0, 255, 255])),
      createLoadedImage("d", makeSolidPng(2, 2, [255, 255, 0, 255]))
    ];

    const shelf = packLoadedImages(images, { maxSize: 10, algorithm: "shelf" });
    const maxRects = packLoadedImages(images, { maxSize: 10, algorithm: "maxrects" });

    expect(shelf.pages).toHaveLength(2);
    expect(maxRects.pages).toHaveLength(1);
    expect(maxRects.pages[0].width).toBeLessThanOrEqual(10);
    expect(maxRects.pages[0].height).toBeLessThanOrEqual(10);
    expect(maxRects.sprites).toHaveLength(images.length);
  });

  it("preserves trim metadata with MaxRects", () => {
    const image = createLoadedImage("trimmed", makeTransparentBorderPng(10, 8, 2, 3, 4, 2));
    const result = packLoadedImages([image], { maxSize: 16, trim: true, algorithm: "maxrects" });

    expect(result.sprites[0]).toMatchObject({
      w: 4,
      h: 2,
      offsetX: 2,
      offsetY: 3,
      trimmed: true
    });
  });

  it("keeps MaxRects extrude coordinates and edge pixels aligned", async () => {
    const dir = await createTempDir();
    const image = createLoadedImage("quad", makeQuadPng());
    const result = packLoadedImages([image], { maxSize: 16, extrude: 1, algorithm: "maxrects" });
    const outputPath = await writeAtlasPng(dir, "atlas", result);
    const atlas = PNG.sync.read(await fs.readFile(outputPath));
    const sprite = result.sprites[0];

    expect(sprite).toMatchObject({
      x: 1,
      y: 1,
      w: 2,
      h: 2,
      drawX: 0,
      drawY: 0,
      drawW: 4,
      drawH: 4
    });
    expect(readPixel(atlas, sprite.drawX, sprite.drawY)).toEqual([255, 0, 0, 255]);
    expect(readPixel(atlas, sprite.drawX + 3, sprite.drawY)).toEqual([0, 255, 0, 255]);
  });

  it("rotates MaxRects placements only when rotate is enabled and placement benefits", async () => {
    const dir = await createTempDir();
    const wide = createLoadedImage("wide", makeSolidPng(5, 3, [255, 0, 0, 255]));
    const tall = createLoadedImage("tall", makePatternPng(2, 3));
    const result = packLoadedImages([wide, tall], {
      maxSize: 5,
      rotate: true,
      algorithm: "maxrects"
    });
    const tallSprite = result.sprites.find((sprite) => sprite.name === "tall");
    const outputPath = await writeAtlasPng(dir, "atlas", result);
    const atlas = PNG.sync.read(await fs.readFile(outputPath));

    expect(tallSprite).toMatchObject({
      rotated: true,
      w: 3,
      h: 2
    });
    expect(readPixel(atlas, tallSprite?.x ?? 0, tallSprite?.y ?? 0)).toEqual([0, 255, 255, 255]);
  });

  it("splits MaxRects output into multiple pages and keeps page indices valid", async () => {
    const inputDir = await createTempDir();
    const outputDir = await createTempDir();
    await writeTestPng(path.join(inputDir, "a.png"), 6, 6, [255, 0, 0, 255]);
    await writeTestPng(path.join(inputDir, "b.png"), 6, 6, [0, 255, 0, 255]);
    await writeTestPng(path.join(inputDir, "c.png"), 6, 6, [0, 0, 255, 255]);

    const result = await makeAtlas(inputDir, outputDir, {
      name: "max_multi",
      maxSize: 6,
      padding: 0,
      format: "json",
      clean: true,
      algorithm: "maxrects"
    });
    const json = JSON.parse(await fs.readFile(result.files.json, "utf8"));

    expect(result.files.pngs.map((file) => path.basename(file))).toEqual([
      "max_multi_0.png",
      "max_multi_1.png",
      "max_multi_2.png"
    ]);
    expect(json.pages).toHaveLength(3);
    expect(json.sprites.map((sprite: { page: number }) => sprite.page)).toEqual([0, 1, 2]);
  });

  it("throws a clear MaxRects oversized error", () => {
    const image = createLoadedImage("too_large", makeSolidPng(9, 9, [255, 0, 0, 255]));

    expect(() => packLoadedImages([image], { maxSize: 8, algorithm: "maxrects" })).toThrow(
      /too_large.*exceeds max size/
    );
  });
});

describe("exporting", () => {
  it("builds the expected JSON structure", () => {
    const image = createLoadedImage("hero_idle_0", makeSolidPng(16, 12, [255, 0, 0, 255]));
    const result = packLoadedImages([image], { maxSize: 64, padding: 2 });

    const json = buildAtlasJson("sample_atlas", result);

    expect(json).toMatchObject({
      version: 1,
      name: "sample_atlas",
      pages: [
        {
          image: "sample_atlas.png",
          width: 16,
          height: 12
        }
      ],
      sprites: [
        {
          name: "hero_idle_0",
          page: 0,
          x: 0,
          y: 0,
          w: 16,
          h: 12,
          rotated: false,
          trimmed: false,
          sourceW: 16,
          sourceH: 12,
          offsetX: 0,
          offsetY: 0,
          pivotX: 0.5,
          pivotY: 0.5
        }
      ]
    });
  });

  it("creates an atlas PNG matching packed coordinates", async () => {
    const dir = await createTempDir();
    const red = createLoadedImage("red", makeSolidPng(4, 4, [255, 0, 0, 255]));
    const blue = createLoadedImage("blue", makeSolidPng(3, 3, [0, 0, 255, 255]));
    const result = packLoadedImages([red, blue], { maxSize: 64, padding: 2 });

    const outputPath = await writeAtlasPng(dir, "atlas", result);
    const output = PNG.sync.read(await fs.readFile(outputPath));
    const redSprite = result.sprites.find((sprite) => sprite.name === "red");
    const blueSprite = result.sprites.find((sprite) => sprite.name === "blue");

    expect(await exists(outputPath)).toBe(true);
    expect(readPixel(output, redSprite?.x ?? 0, redSprite?.y ?? 0)).toEqual([255, 0, 0, 255]);
    expect(readPixel(output, blueSprite?.x ?? 0, blueSprite?.y ?? 0)).toEqual([
      0,
      0,
      255,
      255
    ]);
  });

  it("extrudes edge pixels while keeping JSON rect on the content area", async () => {
    const dir = await createTempDir();
    const image = createLoadedImage("quad", makeQuadPng());
    const result = packLoadedImages([image], { maxSize: 32, extrude: 1 });
    const outputPath = await writeAtlasPng(dir, "atlas", result);
    const atlas = PNG.sync.read(await fs.readFile(outputPath));
    const sprite = result.sprites[0];

    expect(sprite).toMatchObject({
      x: 1,
      y: 1,
      w: 2,
      h: 2,
      drawX: 0,
      drawY: 0,
      drawW: 4,
      drawH: 4
    });
    expect(readPixel(atlas, sprite.drawX, sprite.drawY)).toEqual([255, 0, 0, 255]);
    expect(readPixel(atlas, sprite.drawX + 3, sprite.drawY)).toEqual([0, 255, 0, 255]);
    expect(readPixel(atlas, sprite.x, sprite.y)).toEqual([255, 0, 0, 255]);
  });

  it("applies extrude after trimming", async () => {
    const dir = await createTempDir();
    const image = createLoadedImage("trim_extrude", makeTransparentBorderPng(5, 5, 2, 1, 2, 2));
    const result = packLoadedImages([image], {
      maxSize: 32,
      trim: true,
      extrude: 1
    });
    const outputPath = await writeAtlasPng(dir, "atlas", result);
    const atlas = PNG.sync.read(await fs.readFile(outputPath));
    const sprite = result.sprites[0];

    expect(sprite).toMatchObject({
      x: 1,
      y: 1,
      w: 2,
      h: 2,
      offsetX: 2,
      offsetY: 1,
      trimmed: true,
      drawW: 4,
      drawH: 4
    });
    expect(readPixel(atlas, sprite.drawX, sprite.drawY)).toEqual([255, 0, 0, 255]);
  });

  it("keeps trim, extrude, and rotate coordinates aligned", async () => {
    const dir = await createTempDir();
    const source = makeTransparentPng(4, 6);
    setRect(source, 1, 1, makePatternPng(2, 4));
    const image = createLoadedImage("combo", source);
    const result = packLoadedImages([image], {
      maxSize: 32,
      trim: true,
      extrude: 1,
      rotate: true
    });
    const outputPath = await writeAtlasPng(dir, "atlas", result);
    const atlas = PNG.sync.read(await fs.readFile(outputPath));
    const sprite = result.sprites[0];

    expect(sprite).toMatchObject({
      x: 1,
      y: 1,
      w: 4,
      h: 2,
      offsetX: 1,
      offsetY: 1,
      trimmed: true,
      rotated: true,
      drawW: 6,
      drawH: 4
    });
    expect(readPixel(atlas, sprite.x, sprite.y)).toEqual([255, 128, 0, 255]);
  });

  it("creates atlas PNG, JSON, and log files through the core workflow", async () => {
    const inputDir = await createTempDir();
    const outputDir = await createTempDir();
    await writeTestPng(path.join(inputDir, "hero.png"), 5, 5, [255, 0, 0, 255]);
    await writeTestPng(path.join(inputDir, "coin.png"), 3, 3, [255, 255, 0, 255]);

    const result = await makeAtlas(inputDir, outputDir, {
      name: "sample_atlas",
      maxSize: 64,
      padding: 2,
      format: "json",
      clean: true
    });

    const json = JSON.parse(await fs.readFile(result.files.json, "utf8"));

    expect(result.spriteCount).toBe(2);
    expect(await exists(result.files.png)).toBe(true);
    expect(await exists(result.files.json)).toBe(true);
    expect(await exists(result.files.log)).toBe(true);
    expect(json.sprites).toHaveLength(2);
  });

  it("writes packing algorithm and occupancy details to the log", async () => {
    const inputDir = await createTempDir();
    const outputDir = await createTempDir();
    await writeTestPng(path.join(inputDir, "hero.png"), 5, 5, [255, 0, 0, 255]);
    await writeTestPng(path.join(inputDir, "coin.png"), 3, 3, [255, 255, 0, 255]);

    const result = await makeAtlas(inputDir, outputDir, {
      name: "logged",
      maxSize: 64,
      padding: 2,
      format: "json",
      clean: true,
      algorithm: "maxrects"
    });
    const log = await fs.readFile(result.files.log, "utf8");
    const json = JSON.parse(await fs.readFile(result.files.json, "utf8")) as Record<string, unknown>;

    expect(log).toContain("Algorithm: maxrects");
    expect(log).toContain("Total occupancy:");
    expect(log).toContain("used area:");
    expect(log).toContain("atlas area:");
    expect(log).toContain("Multipack: no");
    expect(json).not.toHaveProperty("algorithm");
    expect(json).not.toHaveProperty("sizeMode");
    expect(json).not.toHaveProperty("cache");
    expect(json).not.toHaveProperty("watch");
  });

  it("resolves tight, pot, and square-pot page sizes", () => {
    expect(resolvePageSize(300, 180, "tight", 512)).toEqual({ width: 300, height: 180 });
    expect(resolvePageSize(300, 180, "pot", 512)).toEqual({ width: 512, height: 256 });
    expect(resolvePageSize(300, 180, "square-pot", 512)).toEqual({ width: 512, height: 512 });
    expect(() => resolvePageSize(300, 180, "pot", 300)).toThrow(/exceeds max size/);
  });

  it("writes power-of-two PNG and JSON page sizes without moving sprite rects", async () => {
    const inputDir = await createTempDir();
    const outputDir = await createTempDir();
    await writeTestPng(path.join(inputDir, "hero.png"), 5, 3, [255, 0, 0, 255]);

    const result = await makeAtlas(inputDir, outputDir, {
      name: "pot_atlas",
      maxSize: 16,
      padding: 0,
      format: "json",
      clean: true,
      sizeMode: "pot"
    });
    const json = JSON.parse(await fs.readFile(result.files.json, "utf8"));
    const atlas = PNG.sync.read(await fs.readFile(result.files.png));

    expect(json.pages[0]).toMatchObject({
      width: 8,
      height: 4
    });
    expect(atlas.width).toBe(json.pages[0].width);
    expect(atlas.height).toBe(json.pages[0].height);
    expect(json.sprites[0]).toMatchObject({
      x: 0,
      y: 0,
      w: 5,
      h: 3
    });
  });

  it("applies square-pot sizing with MaxRects", async () => {
    const inputDir = await createTempDir();
    const outputDir = await createTempDir();
    await writeTestPng(path.join(inputDir, "wide.png"), 9, 3, [255, 0, 0, 255]);
    await writeTestPng(path.join(inputDir, "small.png"), 2, 2, [0, 255, 0, 255]);

    const result = await makeAtlas(inputDir, outputDir, {
      name: "maxrects_pot",
      maxSize: 16,
      padding: 0,
      format: "json",
      clean: true,
      algorithm: "maxrects",
      sizeMode: "square-pot"
    });
    const json = JSON.parse(await fs.readFile(result.files.json, "utf8"));
    const page = json.pages[0];

    expect(page.width).toBe(page.height);
    expect([1, 2, 4, 8, 16]).toContain(page.width);
  });

  it("applies pot sizing per multipack page", async () => {
    const inputDir = await createTempDir();
    const outputDir = await createTempDir();
    await writeTestPng(path.join(inputDir, "a.png"), 6, 6, [255, 0, 0, 255]);
    await writeTestPng(path.join(inputDir, "b.png"), 6, 6, [0, 255, 0, 255]);
    await writeTestPng(path.join(inputDir, "c.png"), 6, 6, [0, 0, 255, 255]);

    const result = await makeAtlas(inputDir, outputDir, {
      name: "multi_pot",
      maxSize: 8,
      padding: 0,
      format: "json",
      clean: true,
      sizeMode: "pot"
    });
    const json = JSON.parse(await fs.readFile(result.files.json, "utf8"));

    expect(json.pages).toHaveLength(3);
    expect(json.pages.map((page: { width: number; height: number }) => `${page.width}x${page.height}`)).toEqual([
      "8x8",
      "8x8",
      "8x8"
    ]);
  });

  it("writes cache files and reports hit, miss, and option invalidation", async () => {
    const inputDir = await createTempDir();
    const outputDir = await createTempDir();
    await writeTestPng(path.join(inputDir, "hero.png"), 5, 5, [255, 0, 0, 255]);

    const first = await makeAtlas(inputDir, outputDir, {
      name: "cached",
      maxSize: 32,
      padding: 0,
      format: "json",
      clean: true,
      cache: true
    });
    const second = await makeAtlas(inputDir, outputDir, {
      name: "cached",
      maxSize: 32,
      padding: 0,
      format: "json",
      clean: true,
      cache: true
    });
    const secondLog = await fs.readFile(second.files.log, "utf8");
    const invalidated = await makeAtlas(inputDir, outputDir, {
      name: "cached",
      maxSize: 32,
      padding: 1,
      format: "json",
      clean: true,
      cache: true
    });

    expect(await exists(getCachePath(outputDir))).toBe(true);
    expect(first.cache.misses).toBe(1);
    expect(second.cache.hits).toBe(1);
    expect(secondLog).toContain("- hits: 1");
    expect(invalidated.cache.invalidationReason).toBe("options changed");
  });

  it("ignores damaged cache files and regenerates cache state", async () => {
    const inputDir = await createTempDir();
    const outputDir = await createTempDir();
    await writeTestPng(path.join(inputDir, "hero.png"), 5, 5, [255, 0, 0, 255]);
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(getCachePath(outputDir), "not-json", "utf8");

    const result = await makeAtlas(inputDir, outputDir, {
      name: "damaged_cache",
      maxSize: 32,
      padding: 0,
      format: "json",
      clean: true,
      cache: true
    });

    expect(result.cache.invalidationReason).toBe("cache file could not be read");
    expect(result.cache.misses).toBe(1);
  });
});

describe("multipack", () => {
  it("keeps 1-page output compatible with the original file naming", async () => {
    const inputDir = await createTempDir();
    const outputDir = await createTempDir();
    await writeTestPng(path.join(inputDir, "a.png"), 4, 4, [255, 0, 0, 255]);
    await writeTestPng(path.join(inputDir, "b.png"), 4, 4, [0, 255, 0, 255]);

    const result = await makeAtlas(inputDir, outputDir, {
      name: "single",
      maxSize: 16,
      padding: 2,
      format: "json",
      clean: true
    });
    const json = JSON.parse(await fs.readFile(result.files.json, "utf8"));

    expect(result.files.pngs.map((file) => path.basename(file))).toEqual(["single.png"]);
    expect(await exists(path.join(outputDir, "single.png"))).toBe(true);
    expect(await exists(path.join(outputDir, "single_0.png"))).toBe(false);
    expect(json.pages).toEqual([
      {
        image: "single.png",
        width: 10,
        height: 4
      }
    ]);
    expect(json.sprites.map((sprite: { x: number; y: number; w: number; h: number }) => sprite)).toMatchObject([
      { x: 0, y: 0, w: 4, h: 4 },
      { x: 6, y: 0, w: 4, h: 4 }
    ]);
  });

  it("splits sprites into multiple pages and writes multipage filenames", async () => {
    const inputDir = await createTempDir();
    const outputDir = await createTempDir();
    await writeTestPng(path.join(inputDir, "a_red.png"), 6, 6, [255, 0, 0, 255]);
    await writeTestPng(path.join(inputDir, "b_green.png"), 6, 6, [0, 255, 0, 255]);
    await writeTestPng(path.join(inputDir, "c_blue.png"), 6, 6, [0, 0, 255, 255]);

    const result = await makeAtlas(inputDir, outputDir, {
      name: "multi",
      maxSize: 6,
      padding: 0,
      format: "json",
      clean: true
    });
    const json = JSON.parse(await fs.readFile(result.files.json, "utf8"));

    expect(result.files.pngs.map((file) => path.basename(file))).toEqual([
      "multi_0.png",
      "multi_1.png",
      "multi_2.png"
    ]);
    expect(json.pages.map((page: { image: string }) => page.image)).toEqual([
      "multi_0.png",
      "multi_1.png",
      "multi_2.png"
    ]);
    expect(json.pages).toHaveLength(3);
    expect(json.sprites.map((sprite: { page: number }) => sprite.page)).toEqual([0, 1, 2]);
  });

  it("draws each page with only that page's sprites", async () => {
    const dir = await createTempDir();
    const red = createLoadedImage("a_red", makeSolidPng(6, 6, [255, 0, 0, 255]));
    const blue = createLoadedImage("b_blue", makeSolidPng(6, 6, [0, 0, 255, 255]));
    const result = packLoadedImages([red, blue], { maxSize: 6 });
    const pngPaths = await writeAtlasPngs(dir, "pages", result);
    const page0 = PNG.sync.read(await fs.readFile(pngPaths[0]));
    const page1 = PNG.sync.read(await fs.readFile(pngPaths[1]));

    expect(readPixel(page0, 0, 0)).toEqual([255, 0, 0, 255]);
    expect(readPixel(page1, 0, 0)).toEqual([0, 0, 255, 255]);
    expect(page0.data.includes(255)).toBe(true);
    expect(page0.data.includes(254)).toBe(false);
  });

  it("keeps padding within each multipack page", () => {
    const images = [
      createLoadedImage("a", makeSolidPng(4, 4, [255, 0, 0, 255])),
      createLoadedImage("b", makeSolidPng(4, 4, [0, 255, 0, 255])),
      createLoadedImage("c", makeSolidPng(4, 4, [0, 0, 255, 255])),
      createLoadedImage("d", makeSolidPng(4, 4, [255, 255, 0, 255])),
      createLoadedImage("e", makeSolidPng(4, 4, [255, 0, 255, 255]))
    ];

    const result = packLoadedImages(images, { maxSize: 10, padding: 2 });

    expect(result.pages.length).toBeGreaterThan(1);
    expect(result.pages[0].sprites.map((sprite) => [sprite.x, sprite.y])).toEqual([
      [0, 0],
      [6, 0],
      [0, 6],
      [6, 6]
    ]);
  });

  it("preserves trim metadata after page splitting", () => {
    const first = createLoadedImage("a", makeTransparentBorderPng(8, 8, 2, 1, 4, 4));
    const second = createLoadedImage("b", makeTransparentBorderPng(8, 8, 3, 2, 4, 4));

    const result = packLoadedImages([first, second], { maxSize: 4, trim: true });

    expect(result.pages).toHaveLength(2);
    expect(result.sprites[0]).toMatchObject({
      page: 0,
      w: 4,
      h: 4,
      offsetX: 2,
      offsetY: 1,
      trimmed: true
    });
    expect(result.sprites[1]).toMatchObject({
      page: 1,
      offsetX: 3,
      offsetY: 2,
      trimmed: true
    });
  });

  it("keeps extrude coordinates and edge pixels on multipack pages", async () => {
    const dir = await createTempDir();
    const first = createLoadedImage("a", makeQuadPng());
    const second = createLoadedImage("b", makeQuadPng());
    const result = packLoadedImages([first, second], { maxSize: 4, extrude: 1 });
    const pngPaths = await writeAtlasPngs(dir, "extruded", result);
    const page0 = PNG.sync.read(await fs.readFile(pngPaths[0]));
    const page1 = PNG.sync.read(await fs.readFile(pngPaths[1]));

    expect(result.pages).toHaveLength(2);
    expect(result.sprites[0]).toMatchObject({ x: 1, y: 1, w: 2, h: 2, drawW: 4, drawH: 4 });
    expect(result.sprites[1]).toMatchObject({ page: 1, x: 1, y: 1 });
    expect(readPixel(page0, 0, 0)).toEqual([255, 0, 0, 255]);
    expect(readPixel(page1, 3, 0)).toEqual([0, 255, 0, 255]);
  });

  it("records rotated sprites and writes rotated pixels across pages", async () => {
    const dir = await createTempDir();
    const first = createLoadedImage("a", makePatternPng(2, 3));
    const second = createLoadedImage("b", makePatternPng(2, 3));
    const result = packLoadedImages([first, second], { maxSize: 3, rotate: true });
    const pngPaths = await writeAtlasPngs(dir, "rotated", result);
    const page0 = PNG.sync.read(await fs.readFile(pngPaths[0]));

    expect(result.pages).toHaveLength(2);
    expect(result.sprites[0]).toMatchObject({
      rotated: true,
      w: 3,
      h: 2
    });
    expect(readPixel(page0, result.sprites[0].x, result.sprites[0].y)).toEqual([
      0,
      255,
      255,
      255
    ]);
  });

  it("keeps trim, extrude, and rotate aligned across multiple pages", async () => {
    const dir = await createTempDir();
    const sourceA = makeTransparentPng(4, 6);
    const sourceB = makeTransparentPng(4, 6);
    setRect(sourceA, 1, 1, makePatternPng(2, 4));
    setRect(sourceB, 1, 1, makePatternPng(2, 4));
    const result = packLoadedImages(
      [createLoadedImage("a", sourceA), createLoadedImage("b", sourceB)],
      {
        maxSize: 6,
        trim: true,
        extrude: 1,
        rotate: true
      }
    );
    const pngPaths = await writeAtlasPngs(dir, "combo", result);
    const page1 = PNG.sync.read(await fs.readFile(pngPaths[1]));

    expect(result.pages).toHaveLength(2);
    expect(result.sprites[0]).toMatchObject({
      x: 1,
      y: 1,
      w: 4,
      h: 2,
      offsetX: 1,
      offsetY: 1,
      rotated: true,
      trimmed: true
    });
    expect(result.sprites[1]).toMatchObject({ page: 1, x: 1, y: 1, rotated: true });
    expect(readPixel(page1, result.sprites[1].x, result.sprites[1].y)).toEqual([
      255,
      128,
      0,
      255
    ]);
  });

  it("throws a clear error for one sprite larger than max-size", () => {
    const image = createLoadedImage("too_large", makeSolidPng(9, 9, [255, 0, 0, 255]));

    expect(() => packLoadedImages([image], { maxSize: 8 })).toThrow(/too_large.*exceeds max size/);
  });

  it("cleans stale multipack page files when a later export becomes single-page", async () => {
    const inputDir = await createTempDir();
    const outputDir = await createTempDir();
    await writeTestPng(path.join(inputDir, "small.png"), 2, 2, [255, 0, 0, 255]);
    await writeTestPng(path.join(outputDir, "cleanme_0.png"), 1, 1, [0, 0, 0, 255]);
    await writeTestPng(path.join(outputDir, "cleanme_1.png"), 1, 1, [0, 0, 0, 255]);
    await fs.writeFile(path.join(outputDir, "cleanme.json"), "stale", "utf8");
    await fs.writeFile(path.join(outputDir, "cleanme.log.txt"), "stale", "utf8");
    await writeTestPng(path.join(outputDir, "unrelated_0.png"), 1, 1, [0, 0, 0, 255]);

    const result = await makeAtlas(inputDir, outputDir, {
      name: "cleanme",
      maxSize: 16,
      padding: 0,
      format: "json",
      clean: true
    });

    expect(path.basename(result.files.png)).toBe("cleanme.png");
    expect(await exists(path.join(outputDir, "cleanme.png"))).toBe(true);
    expect(await exists(path.join(outputDir, "cleanme_0.png"))).toBe(false);
    expect(await exists(path.join(outputDir, "cleanme_1.png"))).toBe(false);
    expect(await exists(path.join(outputDir, "unrelated_0.png"))).toBe(true);
  });
});

describe("Unity runtime compatibility", () => {
  it("keeps JSON sprite field names compatible with the Unity runtime model", () => {
    const image = createLoadedImage("unity_sprite", makeTransparentBorderPng(8, 8, 2, 1, 4, 5));
    const result = packLoadedImages([image], {
      maxSize: 16,
      trim: true,
      extrude: 1,
      rotate: true
    });
    const json = buildAtlasJson("unity_atlas", result);
    const sprite = json.sprites[0];
    const requiredFields = [
      "name",
      "page",
      "x",
      "y",
      "w",
      "h",
      "rotated",
      "trimmed",
      "sourceW",
      "sourceH",
      "offsetX",
      "offsetY",
      "pivotX",
      "pivotY"
    ];

    for (const field of requiredFields) {
      expect(sprite).toHaveProperty(field);
    }

    expect(json.version).toBe(1);
    expect(json.pages[0]).toHaveProperty("image");
    expect(json.pages[0]).toHaveProperty("width");
    expect(json.pages[0]).toHaveProperty("height");
  });

  it("keeps engine integration metadata out of the exported atlas JSON", () => {
    const image = createLoadedImage("plain_sprite", makeSolidPng(4, 4, [255, 0, 0, 255]));
    const result = packLoadedImages([image], { maxSize: 16 });
    const json = buildAtlasJson("plain_atlas", result);

    expect(Object.keys(json.pages[0]).sort()).toEqual(["height", "image", "width"]);
    expect(Object.keys(json.sprites[0]).sort()).toEqual([
      "h",
      "name",
      "offsetX",
      "offsetY",
      "page",
      "pivotX",
      "pivotY",
      "rotated",
      "sourceH",
      "sourceW",
      "trimmed",
      "w",
      "x",
      "y"
    ]);
    expect(JSON.stringify(json)).not.toMatch(/Unity|MonoGame|pipeline|projectFile/i);
  });

  it("includes the Unity runtime package and basic loader sample files", async () => {
    const files = [
      "integrations/unity/package.json",
      "integrations/unity/Runtime/SuwolAtlasData.cs",
      "integrations/unity/Runtime/SuwolAtlasLoader.cs",
      "integrations/unity/Runtime/SuwolAtlas.cs",
      "integrations/unity/Runtime/SuwolAtlasAsset.cs",
      "integrations/unity/Runtime/SuwolAtlasMetadataData.cs",
      "integrations/unity/Runtime/SuwolAtlasMetadataLoader.cs",
      "integrations/unity/Samples~/BasicLoader/SuwolAtlasBasicExample.cs"
    ];

    for (const file of files) {
      expect(await exists(path.join(process.cwd(), file))).toBe(true);
    }
  });

  it("includes optional Unity metadata sidecar loader APIs and Editor display code", async () => {
    const loader = await fs.readFile(
      path.join(process.cwd(), "integrations/unity/Runtime/SuwolAtlasMetadataLoader.cs"),
      "utf8"
    );
    const editorWindow = await fs.readFile(
      path.join(process.cwd(), "integrations/unity/Editor/SuwolAtlasEditorWindow.cs"),
      "utf8"
    );

    expect(loader).toContain("SuwolAtlasMetadataLoader");
    expect(loader).toContain("GetTags");
    expect(loader).toContain("GetGroup");
    expect(loader).toContain("HasTag");
    expect(loader).toContain("TryGetMetadata");
    expect(editorWindow).toContain("Metadata JSON");
    expect(editorWindow).toContain("DrawSpriteMetadata");
    expect(editorWindow).toContain("Trim Mode");
    expect(editorWindow).toContain("Crop");
  });

  it("includes the Unity Editor importer, viewer, validation, texture settings, and sample", async () => {
    const files = [
      "integrations/unity/Editor/Suwol.AtlasMaker.Editor.asmdef",
      "integrations/unity/Editor/SuwolAtlasEditorWindow.cs",
      "integrations/unity/Editor/SuwolAtlasImportUtility.cs",
      "integrations/unity/Editor/SuwolAtlasTextureSettings.cs",
      "integrations/unity/Editor/SuwolAtlasValidationReport.cs",
      "integrations/unity/Editor/SuwolAtlasAssetPostprocessor.cs",
      "integrations/unity/Editor/SuwolAtlasPostprocessorSettings.cs",
      "integrations/unity/Samples~/EditorImporter/README.md",
      "integrations/unity/Samples~/EditorImporter/SuwolAtlasAssetExample.cs"
    ];

    for (const file of files) {
      expect(await exists(path.join(process.cwd(), file))).toBe(true);
    }
  });

  it("keeps UnityEditor references out of Unity runtime files", async () => {
    const runtimeFiles = await listFiles(path.join(process.cwd(), "integrations/unity/Runtime"), ".cs");

    for (const file of runtimeFiles) {
      const text = await fs.readFile(file, "utf8");
      expect(text).not.toContain("UnityEditor");
    }

    const editorUtility = await fs.readFile(
      path.join(process.cwd(), "integrations/unity/Editor/SuwolAtlasImportUtility.cs"),
      "utf8"
    );
    expect(editorUtility).toContain("UnityEditor");
  });

  it("wires the Unity Editor menu, runtime asset helper, and integration check script", async () => {
    const editorWindow = await fs.readFile(
      path.join(process.cwd(), "integrations/unity/Editor/SuwolAtlasEditorWindow.cs"),
      "utf8"
    );
    const asset = await fs.readFile(
      path.join(process.cwd(), "integrations/unity/Runtime/SuwolAtlasAsset.cs"),
      "utf8"
    );
    const asmdef = JSON.parse(
      await fs.readFile(
        path.join(process.cwd(), "integrations/unity/Editor/Suwol.AtlasMaker.Editor.asmdef"),
        "utf8"
      )
    ) as { includePlatforms: string[]; references: string[] };
    const packageJson = JSON.parse(await fs.readFile(path.join(process.cwd(), "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(editorWindow).toContain("Tools/Suwol Atlas Maker/Open Atlas Viewer");
    expect(editorWindow).toContain("Create/Update SuwolAtlasAsset");
    expect(editorWindow).toContain("Postprocessor Settings");
    expect(editorWindow).toContain("Search");
    expect(asset).toContain("SuwolAtlas Load()");
    expect(asset).toContain("Sprite CreateSprite(string spriteName)");
    expect(asmdef.includePlatforms).toContain("Editor");
    expect(asmdef.references).toContain("Suwol.AtlasMaker.Runtime");
    expect(packageJson.scripts["build:unity-check"]).toBe("node scripts/check-unity-integration.mjs");
  });

  it("includes Unity AssetPostprocessor with project/export JSON distinction and default-off settings", async () => {
    const postprocessor = await fs.readFile(
      path.join(process.cwd(), "integrations/unity/Editor/SuwolAtlasAssetPostprocessor.cs"),
      "utf8"
    );
    const settings = await fs.readFile(
      path.join(process.cwd(), "integrations/unity/Editor/SuwolAtlasPostprocessorSettings.cs"),
      "utf8"
    );

    expect(postprocessor).toContain("AssetPostprocessor");
    expect(postprocessor).toContain("OnPostprocessAllAssets");
    expect(postprocessor).toContain("Validate Selected Atlas");
    expect(postprocessor).toContain("Create Atlas Asset From Selected");
    expect(postprocessor).toContain("LooksLikeProjectFile");
    expect(postprocessor).toContain("pages");
    expect(postprocessor).toContain("enablePostprocessor");
    expect(postprocessor).toContain("autoApplyTextureSettings");
    expect(postprocessor).toContain("autoCreateAtlasAsset");
    expect(postprocessor).toContain(".suwol-atlas.asset");
    expect(settings).toContain("Tools/Suwol Atlas Maker/Postprocessor Settings");
    expect(settings).toContain("Tools/Suwol Atlas Maker/Settings");
    expect(settings).toContain("enablePostprocessor = false");
    expect(settings).toContain("autoApplyTextureSettings = false");
    expect(settings).toContain("autoCreateAtlasAsset = false");
    expect(settings).toContain("generatedAssetSuffix");
    expect(settings).toContain("logVerbose");
  });

  it("distinguishes Unity project files from exported atlas JSON", async () => {
    const utility = await fs.readFile(
      path.join(process.cwd(), "integrations/unity/Editor/SuwolAtlasImportUtility.cs"),
      "utf8"
    );

    expect(utility).toContain(".suwol-atlas.json project file");
    expect(utility).toContain("not an atlas export JSON");
    expect(utility).toContain("FindPageTextures");
  });
});

describe("MonoGame runtime compatibility", () => {
  it("includes the MonoGame runtime project, loader, sample, and docs", async () => {
    const files = [
      "integrations/monogame/Suwol.AtlasMaker.MonoGame.csproj",
      "integrations/monogame/Runtime/SuwolAtlasData.cs",
      "integrations/monogame/Runtime/SuwolAtlasLoader.cs",
      "integrations/monogame/Runtime/SuwolAtlas.cs",
      "integrations/monogame/Runtime/SuwolAtlasFrame.cs",
      "integrations/monogame/Runtime/SuwolAtlasSpriteBatchExtensions.cs",
      "integrations/monogame/Runtime/SuwolAtlasContent.cs",
      "integrations/monogame/Runtime/SuwolAtlasReader.cs",
      "integrations/monogame/Runtime/SuwolAtlasMetadataData.cs",
      "integrations/monogame/Runtime/SuwolAtlasMetadataLoader.cs",
      "integrations/monogame/Samples/BasicLoader/BasicAtlasGame.cs",
      "integrations/monogame/README.md"
    ];

    for (const file of files) {
      expect(await exists(path.join(process.cwd(), file))).toBe(true);
    }
  });

  it("includes optional MonoGame metadata sidecar loader APIs", async () => {
    const loader = await fs.readFile(
      path.join(process.cwd(), "integrations/monogame/Runtime/SuwolAtlasMetadataLoader.cs"),
      "utf8"
    );
    const data = await fs.readFile(
      path.join(process.cwd(), "integrations/monogame/Runtime/SuwolAtlasMetadataData.cs"),
      "utf8"
    );

    expect(loader).toContain("SuwolAtlasMetadataLoader");
    expect(loader).toContain("GetTags");
    expect(loader).toContain("GetGroup");
    expect(loader).toContain("HasTag");
    expect(loader).toContain("TryGetMetadata");
    expect(data).toContain("JsonPropertyName(\"sourcePath\")");
    expect(data).toContain("JsonPropertyName(\"tags\")");
    expect(data).toContain("JsonPropertyName(\"order\")");
    expect(data).toContain("JsonPropertyName(\"trimMode\")");
    expect(data).toContain("JsonPropertyName(\"crop\")");
  });

  it("includes the MonoGame Content Pipeline project, importer, processor, writer, and sample", async () => {
    const files = [
      "integrations/monogame/Suwol.AtlasMaker.MonoGame.Pipeline.csproj",
      "integrations/monogame/Directory.Build.props",
      "integrations/monogame/Pipeline/SuwolAtlasContent.cs",
      "integrations/monogame/Pipeline/SuwolAtlasImporter.cs",
      "integrations/monogame/Pipeline/SuwolAtlasProcessor.cs",
      "integrations/monogame/Pipeline/SuwolAtlasWriter.cs",
      "integrations/monogame/Samples/ContentPipeline/README.md",
      "integrations/monogame/Samples/ContentPipeline/Content.mgcb",
      "integrations/monogame/Samples/ContentPipeline/ContentPipelineAtlasGame.cs"
    ];

    for (const file of files) {
      expect(await exists(path.join(process.cwd(), file))).toBe(true);
    }
  });

  it("wires MonoGame Content Pipeline writer, reader, loader, and build script", async () => {
    const writer = await fs.readFile(
      path.join(process.cwd(), "integrations/monogame/Pipeline/SuwolAtlasWriter.cs"),
      "utf8"
    );
    const reader = await fs.readFile(
      path.join(process.cwd(), "integrations/monogame/Runtime/SuwolAtlasReader.cs"),
      "utf8"
    );
    const loader = await fs.readFile(
      path.join(process.cwd(), "integrations/monogame/Runtime/SuwolAtlasLoader.cs"),
      "utf8"
    );
    const pipelineProject = await fs.readFile(
      path.join(process.cwd(), "integrations/monogame/Suwol.AtlasMaker.MonoGame.Pipeline.csproj"),
      "utf8"
    );
    const monogameProps = await fs.readFile(
      path.join(process.cwd(), "integrations/monogame/Directory.Build.props"),
      "utf8"
    );
    const packageJson = JSON.parse(await fs.readFile(path.join(process.cwd(), "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(writer).toContain("GetRuntimeReader");
    expect(writer).toContain("Suwol.AtlasMaker.MonoGame.SuwolAtlasReader, Suwol.AtlasMaker.MonoGame");
    expect(reader).toContain("ContentTypeReader<SuwolAtlasContent>");
    expect(loader).toContain("FromContent(SuwolAtlasContent content, Texture2D[] pages)");
    expect(pipelineProject).toContain("Compile Remove=\"Runtime\\**\\*.cs\"");
    expect(pipelineProject).toContain("Compile Remove=\"Samples\\**\\*.cs\"");
    expect(pipelineProject).toContain("PackageDownload Include=\"dotnet-mgcb\"");
    expect(pipelineProject).toContain("$(NuGetPackageRoot)\\dotnet-mgcb");
    expect(pipelineProject).toContain("MonoGame.Framework.Content.Pipeline");
    expect(monogameProps).toContain("Suwol.AtlasMaker.MonoGame.Pipeline");
    expect(monogameProps).toContain("DefaultItemExcludes");
    expect(monogameProps).toContain("monogame-pipeline");
    expect(monogameProps).toContain("MSBuildProjectExtensionsPath");
    expect(packageJson.scripts["build:monogame:pipeline"]).toBe(
      "dotnet build integrations/monogame/Suwol.AtlasMaker.MonoGame.Pipeline.csproj"
    );
  });

  it("distinguishes MonoGame project files from exported atlas JSON", async () => {
    const importer = await fs.readFile(
      path.join(process.cwd(), "integrations/monogame/Pipeline/SuwolAtlasImporter.cs"),
      "utf8"
    );

    expect(importer).toContain(".suwol-atlas.json project file");
    expect(importer).toContain("pages[]");
    expect(importer).toContain("sprites[]");
    expect(importer).toContain("inputDir");
    expect(importer).toContain("outputDir");
  });

  it("keeps MonoGame data model attributes aligned with JSON field names", async () => {
    const dataModel = await fs.readFile(
      path.join(process.cwd(), "integrations/monogame/Runtime/SuwolAtlasData.cs"),
      "utf8"
    );
    const fields = [
      "version",
      "name",
      "pages",
      "sprites",
      "image",
      "width",
      "height",
      "page",
      "x",
      "y",
      "w",
      "h",
      "rotated",
      "trimmed",
      "sourceW",
      "sourceH",
      "offsetX",
      "offsetY",
      "pivotX",
      "pivotY"
    ];

    for (const field of fields) {
      expect(dataModel).toContain(`JsonPropertyName("${field}")`);
    }
  });

  it("keeps multipack JSON page images and sprite page indices valid for MonoGame loading", async () => {
    const inputDir = await createTempDir();
    const outputDir = await createTempDir();
    await writeTestPng(path.join(inputDir, "a.png"), 6, 6, [255, 0, 0, 255]);
    await writeTestPng(path.join(inputDir, "b.png"), 6, 6, [0, 255, 0, 255]);

    const result = await makeAtlas(inputDir, outputDir, {
      name: "monogame_multi",
      maxSize: 6,
      padding: 0,
      format: "json",
      clean: true
    });
    const json = JSON.parse(await fs.readFile(result.files.json, "utf8"));

    expect(json.pages.length).toBeGreaterThan(1);

    for (const page of json.pages as Array<{ image: string }>) {
      expect(await exists(path.join(outputDir, page.image))).toBe(true);
    }

    for (const sprite of json.sprites as Array<{ page: number }>) {
      expect(sprite.page).toBeGreaterThanOrEqual(0);
      expect(sprite.page).toBeLessThan(json.pages.length);
    }
  });

  it("documents MonoGame loading, rotation, trim metadata, and disposal", async () => {
    const rootReadme = await fs.readFile(path.join(process.cwd(), "README.md"), "utf8");
    const monoReadme = await fs.readFile(
      path.join(process.cwd(), "integrations/monogame/README.md"),
      "utf8"
    );

    expect(rootReadme).toContain("MonoGame Runtime");
    expect(monoReadme).toContain("SuwolAtlasLoader.Load");
    expect(monoReadme).toContain("DrawAtlasSprite");
    expect(monoReadme).toContain("Rotated Sprites");
    expect(monoReadme).toContain("Trim Metadata");
    expect(monoReadme).toContain("Dispose");
  });
});

describe("GUI MVP support", () => {
  it("converts GUI options to core makeAtlas options without changing export semantics", () => {
    const options = {
      inputDir: "input",
      outputDir: "output",
      name: "gui_atlas",
      maxSize: 4096,
      padding: 4,
      trim: true,
      extrude: 2,
      rotate: true,
      clean: false,
      algorithm: "maxrects" as const,
      sizeMode: "pot" as const,
      cache: true,
      watch: false,
      profile: "unity" as const,
      spriteMetadata: {
        "hero.png": {
          include: false
        }
      }
    };

    expect(toCoreMakeAtlasOptions(options)).toEqual({
      name: "gui_atlas",
      maxSize: 4096,
      padding: 4,
      format: "json",
      clean: false,
      trim: true,
      extrude: 2,
      rotate: true,
      algorithm: "maxrects",
      sizeMode: "pot",
      cache: true,
      spriteMetadata: {
        "hero.png": {
          include: false
        }
      }
    });
  });

  it("returns default GUI settings when stored settings are missing or damaged", () => {
    expect(normalizeGuiSettings(null)).toEqual(DEFAULT_GUI_SETTINGS);
    expect(normalizeGuiSettings({ maxSize: -1, padding: -2, extrude: -3 })).toMatchObject({
      maxSize: DEFAULT_GUI_SETTINGS.maxSize,
      padding: DEFAULT_GUI_SETTINGS.padding,
      extrude: DEFAULT_GUI_SETTINGS.extrude
    });
    expect(normalizeGuiSettings({ maxSize: 123, padding: 1, extrude: 2 })).toMatchObject({
      maxSize: DEFAULT_GUI_SETTINGS.maxSize,
      padding: 1,
      extrude: 2
    });
  });

  it("validates renderer export options before IPC export", () => {
    expect(validateGuiExportOptions(DEFAULT_GUI_SETTINGS).valid).toBe(false);
    expect(
      validateGuiExportOptions({
        ...DEFAULT_GUI_SETTINGS,
        inputDir: "input",
        outputDir: "output",
        name: "atlas",
        maxSize: 2048,
        padding: 0,
        extrude: 0
      }).valid
    ).toBe(true);
    expect(
      validateGuiExportOptions({
        ...DEFAULT_GUI_SETTINGS,
        inputDir: "input",
        outputDir: "output",
        name: "atlas",
        maxSize: 123,
        padding: -1,
        extrude: 1.5
      }).errors
    ).toEqual([
      "Max size must be one of 1024, 2048, 4096, or 8192.",
      "Padding must be a non-negative integer.",
      "Extrude must be a non-negative integer."
    ]);
  });

  it("builds export result card summaries with files and elapsed time", () => {
    const summary = buildExportResultSummary({
      spriteCount: 3,
      previewPages: [{}, {}],
      pngPaths: ["out/atlas_0.png", "out/atlas_1.png"],
      jsonPath: "out/atlas.json",
      metadataPath: "out/atlas.metadata.json",
      logPath: "out/atlas.log.txt",
      elapsedMs: 1234
    });

    expect(summary).toEqual({
      pageCount: 2,
      spriteCount: 3,
      outputFiles: [
        "out/atlas_0.png",
        "out/atlas_1.png",
        "out/atlas.json",
        "out/atlas.metadata.json",
        "out/atlas.log.txt"
      ],
      elapsed: "1.2 s"
    });
    expect(formatElapsedMs(42)).toBe("42 ms");
  });

  it("maps common GUI errors to user-facing categories with raw detail retained", () => {
    expect(classifyGuiError("Input folder is required.")).toMatchObject({ code: "inputRequired" });
    expect(classifyGuiError("No PNG files found in input directory: input")).toMatchObject({ code: "noPngFiles" });
    expect(classifyGuiError('Duplicate export sprite name "hero".')).toMatchObject({ code: "duplicateSpriteName" });
    expect(classifyGuiError('Image "too_large" exceeds max size 8x8 after trim/extrude: 16x16.')).toMatchObject({ code: "maxSizeExceeded" });
    expect(classifyGuiError("Sprite metadata crop is outside source image bounds for \"hero.png\".")).toMatchObject({ code: "cropInvalid" });
    expect(classifyGuiError("Output directory path is required.")).toMatchObject({ code: "outputFolderMissing" });
    expect(classifyGuiError("Could not open output directory: access denied")).toMatchObject({ code: "outputFolderMissing" });
    expect(classifyGuiError("Unexpected issue")).toEqual({ code: "fallback", detail: "Unexpected issue" });
  });

  it("provides guided fixes for common GUI error categories", () => {
    expect(getErrorGuideCodes()).toContain("noPngFiles");
    expect(getErrorGuide("inputRequired").messageKey).toBe("errors:friendly.inputRequired");
    expect(getErrorGuide("inputRequired").actionKeys).toContain("errors:guide.inputRequired.selectFolder");
    expect(getErrorGuide("outputFolderMissing").actionKeys).toContain("errors:guide.outputFolderMissing.permission");
  });

  it("validates exported atlas files without changing the atlas JSON schema", async () => {
    const dir = await createTempDir();
    const jsonPath = path.join(dir, "atlas.json");
    const metadataPath = path.join(dir, "atlas.metadata.json");
    const atlas = {
      version: 1 as const,
      name: "atlas",
      pages: [{ image: "atlas.png", width: 4, height: 4 }],
      sprites: [{
        name: "hero",
        page: 0,
        x: 0,
        y: 0,
        w: 4,
        h: 4,
        rotated: false,
        trimmed: false,
        sourceW: 4,
        sourceH: 4,
        offsetX: 0,
        offsetY: 0,
        pivotX: 0.5,
        pivotY: 0.5
      }]
    };

    await writeTestPng(path.join(dir, "atlas.png"), 4, 4, [255, 0, 0, 255]);
    await fs.writeFile(jsonPath, `${JSON.stringify(atlas, null, 2)}\n`, "utf8");
    await fs.writeFile(metadataPath, JSON.stringify({ version: 1, atlas: "atlas", sprites: [{ name: "ghost" }] }), "utf8");

    const warning = await validateExportResult({
      outputDir: dir,
      jsonPath,
      pngPaths: [path.join(dir, "atlas.png")],
      metadataPath,
      atlasJson: atlas
    });
    const display = buildExportValidationDisplay(warning);

    expect(warning.status).toBe("warning");
    expect(warning.issues.map((issue) => issue.code)).toContain("metadataSpriteMissing");
    expect(display.titleKey).toBe("diagnostics:validation.warning.title");
    expect(formatExportValidationLog(warning)).toContain("metadataSpriteMissing");
    expect(JSON.stringify(atlas)).not.toContain("validation");
    expect(JSON.stringify(atlas)).not.toContain("help");
    expect(JSON.stringify(atlas)).not.toContain("errorGuide");

    const error = await validateExportResult({
      outputDir: dir,
      jsonPath,
      pngPaths: [path.join(dir, "atlas.png")],
      atlasJson: {
        ...atlas,
        sprites: [{ ...atlas.sprites[0], x: 3, w: 4 }]
      }
    });

    expect(error.status).toBe("error");
    expect(error.issues.map((issue) => issue.code)).toContain("spriteRectOutOfBounds");
  });

  it("keeps Open Output Folder wired through IPC with missing-folder feedback", async () => {
    const main = await fs.readFile(path.join(process.cwd(), "src/electron/main.ts"), "utf8");
    const preload = await fs.readFile(path.join(process.cwd(), "src/electron/preload.ts"), "utf8");
    const app = await fs.readFile(path.join(process.cwd(), "src/renderer/App.tsx"), "utf8");

    expect(main).toContain('ipcMain.handle("atlas:openOutputDirectory"');
    expect(main).toContain("shell.openPath(directoryPath)");
    expect(main).toContain("Output directory path is required.");
    expect(main).toContain("Output directory does not exist");
    expect(preload).toContain("openOutputDirectory");
    expect(app).toContain("showError(new Error(\"Output directory path is required.\"))");
    expect(app).toContain("diagnostics:resultCard.openOutput");
  });

  it("keeps cache clearing limited to atlas cache files", async () => {
    const main = await fs.readFile(path.join(process.cwd(), "src/electron/main.ts"), "utf8");
    const preload = await fs.readFile(path.join(process.cwd(), "src/electron/preload.ts"), "utf8");
    const app = await fs.readFile(path.join(process.cwd(), "src/renderer/App.tsx"), "utf8");

    expect(main).toContain('ipcMain.handle("maintenance:clearAtlasCaches"');
    expect(main).toContain('path.join(directory, ".suwol-atlas-cache.json")');
    expect(main).not.toContain("fs.rm(directory");
    expect(preload).toContain("clearAtlasCaches");
    expect(app).toContain("project:maintenance.cacheConfirm");
  });

  it("calculates preview page images from JSON pages instead of guessing filenames", () => {
    expect(
      getPreviewPageImages({
        version: 1,
        name: "multi",
        pages: [
          { image: "multi_0.png", width: 64, height: 64 },
          { image: "multi_1.png", width: 32, height: 32 }
        ],
        sprites: []
      })
    ).toEqual(["multi_0.png", "multi_1.png"]);
  });

  it("filters sprites by name for the renderer sprite list", () => {
    const sprites = [
      { name: "hero_idle", page: 0, x: 0, y: 0, w: 1, h: 1, rotated: false, trimmed: false, sourceW: 1, sourceH: 1, offsetX: 0, offsetY: 0, pivotX: 0.5, pivotY: 0.5 },
      { name: "coin_spin", page: 0, x: 2, y: 0, w: 1, h: 1, rotated: false, trimmed: false, sourceW: 1, sourceH: 1, offsetX: 0, offsetY: 0, pivotX: 0.5, pivotY: 0.5 }
    ];

    expect(filterSprites(sprites, "hero").map((sprite) => sprite.name)).toEqual(["hero_idle"]);
    expect(filterSprites(sprites, "").map((sprite) => sprite.name)).toEqual(["hero_idle", "coin_spin"]);
  });

  it("includes Electron main, preload, renderer entry, App, and GUI type files", async () => {
    const files = [
      "src/electron/main.ts",
      "src/electron/preload.ts",
      "src/renderer/main.tsx",
      "src/renderer/App.tsx",
      "src/renderer/components/PreviewPanel.tsx",
      "src/renderer/components/SpriteTable.tsx",
      "src/renderer/components/SpriteMetadataTable.tsx",
      "src/shared/gui-types.ts"
    ];

    for (const file of files) {
      expect(await exists(path.join(process.cwd(), file))).toBe(true);
    }

    const app = await fs.readFile(path.join(process.cwd(), "src/renderer/App.tsx"), "utf8");
    const main = await fs.readFile(path.join(process.cwd(), "src/electron/main.ts"), "utf8");
    const preload = await fs.readFile(path.join(process.cwd(), "src/electron/preload.ts"), "utf8");
    const preview = await fs.readFile(path.join(process.cwd(), "src/renderer/components/PreviewPanel.tsx"), "utf8");

    expect(app).toContain("SpriteMetadataTable");
    expect(app).toContain("scanInput");
    expect(app).toContain("setSpriteMetadataEntry");
    expect(app).toContain("SourceCropEditor");
    expect(app).toContain("reorderInputSpriteOrder");
    expect(app).toContain("validateSpriteCropRect");
    expect(app).toContain("undoEditorHistory");
    expect(app).toContain("cleanupMissingMetadata");
    expect(app).toContain("sourcePointFromPreviewPoint");
    expect(app).toContain("reorderVisibleInputSpriteOrder");
    expect(app).toContain("runCurrentBatchSet");
    expect(preview).toContain("onPivotChange");
    expect(preview).toContain("calculatePivotFromStagePoint");
    expect(main).toContain("atlas:scanInput");
    expect(main).toContain("atlas:getSourceImagePreview");
    expect(main).toContain("batchSet:openDialog");
    expect(main).toContain("project:openSample");
    expect(main).toContain("recent:listItems");
    expect(main).toContain("recent:clean");
    expect(main).toContain("maintenance:clearAtlasCaches");
    expect(main).toContain("toSavedBatchSet");
    expect(main).toContain("resolveInputRelativePath");
    expect(main).toContain("findAutoTrimCrop");
    expect(preload).toContain("scanInput");
    expect(preload).toContain("getSourceImagePreview");
    expect(preload).toContain("runBatchSet");
    expect(preload).toContain("openSampleProject");
    expect(preload).toContain("listRecentItems");
    expect(preload).toContain("clearAtlasCaches");
  });
});

describe("GUI i18n and layout support", () => {
  it("includes English and Korean locale files with matching nested keys", async () => {
    const localeRoot = path.join(process.cwd(), "src", "shared", "i18n", "locales");
    const enFiles = await fs.readdir(path.join(localeRoot, "en"));
    const koFiles = await fs.readdir(path.join(localeRoot, "ko"));
    const expectedFiles = I18N_NAMESPACES.map((namespace) => `${namespace}.json`).sort();

    expect(enFiles.filter((file) => file.endsWith(".json")).sort()).toEqual(expectedFiles);
    expect(koFiles.filter((file) => file.endsWith(".json")).sort()).toEqual(expectedFiles);

    for (const file of expectedFiles) {
      const en = JSON.parse(await fs.readFile(path.join(localeRoot, "en", file), "utf8"));
      const ko = JSON.parse(await fs.readFile(path.join(localeRoot, "ko", file), "utf8"));

      expect(flattenLocaleKeys(ko)).toEqual(flattenLocaleKeys(en));
      expect(localeStringValues(en).every((value) => value.trim().length > 0)).toBe(true);
      expect(localeStringValues(ko).every((value) => value.trim().length > 0)).toBe(true);
    }
  });

  it("includes help guide namespaces and menu labels for guidance actions", async () => {
    const enHelp = JSON.parse(await fs.readFile(path.join(process.cwd(), "src/shared/i18n/locales/en/help.json"), "utf8"));
    const koHelp = JSON.parse(await fs.readFile(path.join(process.cwd(), "src/shared/i18n/locales/ko/help.json"), "utf8"));
    const enMenu = JSON.parse(await fs.readFile(path.join(process.cwd(), "src/shared/i18n/locales/en/menu.json"), "utf8"));
    const koMenu = JSON.parse(await fs.readFile(path.join(process.cwd(), "src/shared/i18n/locales/ko/menu.json"), "utf8"));
    const app = await fs.readFile(path.join(process.cwd(), "src/renderer/App.tsx"), "utf8");

    expect(I18N_NAMESPACES).toContain("help");
    expect(flattenLocaleKeys(koHelp)).toEqual(flattenLocaleKeys(enHelp));
    expect(enHelp.tabs.quickStart).toBe("Quick Start");
    expect(koHelp.tabs.quickStart).toBe("빠른 시작");
    expect(enMenu.troubleshooting).toBe("Troubleshooting");
    expect(koMenu.troubleshooting).toBe("문제 해결");
    expect(app).toContain("renderHelpDialog");
    expect(app).toContain("help:sections");
  });

  it("resolves system and explicit language settings", () => {
    expect(resolveAppLanguage("system", "ko-KR")).toBe("ko");
    expect(resolveAppLanguage("system", "en-US")).toBe("en");
    expect(resolveAppLanguage("system", "fr-FR")).toBe("en");
    expect(resolveAppLanguage("ko", "en-US")).toBe("ko");
    expect(resolveAppLanguage("en", "ko-KR")).toBe("en");
  });

  it("uses a registry and locale loader for enabled languages", () => {
    expect(languageOptions.map((option) => option.id)).toEqual(["system", "en", "ko"]);
    expect(getEnabledLocaleIds()).toEqual(["en", "ko"]);
    expect(getLocaleNamespaceFileNames()).toEqual(I18N_NAMESPACES.map((namespace) => `${namespace}.json`));
    expect(hasCompleteLocaleNamespaceSet(getLocaleNamespaceFileNames())).toBe(true);
  });

  it("migrates GUI settings with language and layout defaults", () => {
    expect(normalizeGuiSettings({}).language).toBe("system");
    expect(normalizeGuiSettings({ language: "invalid" }).language).toBe("system");
    expect(normalizeGuiSettings({ language: "ko" }).language).toBe("ko");
    expect(normalizeAppLanguage("bad")).toBe("system");
    expect(normalizeGuiSettings({}).advancedCollapsed).toBe(true);
    expect(normalizeGuiSettings({}).logCollapsed).toBe(true);
    expect(normalizeGuiSettings({}).rightPanelTab).toBe("list");
    expect(normalizeGuiSettings({}).useRecommendedSettings).toBe(false);
    expect(normalizeGuiSettings({
      recentInputDirs: ["C:/Sprites", "C:/Sprites", ""],
      recentOutputDirs: ["C:/Atlas"],
      useRecommendedSettings: true
    })).toMatchObject({
      recentInputDirs: ["C:/Sprites"],
      recentOutputDirs: ["C:/Atlas"],
      useRecommendedSettings: true
    });
    expect(normalizeGuiSettings({}).layout).toEqual(DEFAULT_GUI_LAYOUT);
    expect(normalizeRightPanelTab("batch")).toBe("batch");
    expect(normalizeRightPanelTab("sprites")).toBe("list");
    expect(normalizeRightPanelTab("unknown")).toBe("list");

    const legacy = normalizeGuiSettings({
      advancedCollapsed: false,
      logCollapsed: false,
      rightPanelTab: "sprites"
    });
    expect(legacy.layout.advancedCollapsed).toBe(false);
    expect(legacy.layout.statusPanelOpen).toBe(true);
    expect(legacy.layout.rightPanelTab).toBe("list");

    const clamped = normalizeGuiSettings({
      layout: {
        leftPanelOpen: false,
        rightPanelOpen: true,
        leftPanelWidth: 9999,
        rightPanelWidth: -1,
        bottomLogHeight: "bad",
        advancedCollapsed: false,
        logCollapsed: false,
        rightPanelTab: "filters"
      }
    });
    expect(clamped.layout.leftPanelWidth).toBe(GUI_LAYOUT_LIMITS.leftPanelWidth.max);
    expect(clamped.layout.rightPanelWidth).toBe(GUI_LAYOUT_LIMITS.rightPanelWidth.min);
    expect(clamped.layout.bottomStatusHeight).toBe(DEFAULT_GUI_LAYOUT.bottomStatusHeight);
    expect(clamped.layout.leftPanelOpen).toBe(false);
    expect(clamped.layout.rightPanelOpen).toBe(true);
    expect(clamped.layout.statusPanelOpen).toBe(true);
    expect(clamped.advancedCollapsed).toBe(false);
    expect(clamped.logCollapsed).toBe(false);
    expect(clamped.rightPanelTab).toBe("filters");

    expect(normalizeGuiLayoutSettings({ leftPanelWidth: Number.NaN })).toEqual(DEFAULT_GUI_LAYOUT);
  });

  it("localizes menu labels and keeps required menu keys", () => {
    const en = getMenuLabels("en");
    const ko = getMenuLabels("ko");

    expect(en.file).toBe("File");
    expect(en.actions).toBe("Actions");
    expect(en.view).toBe("View");
    expect(en.help).toBe("Help");
    expect(ko.file).toBe("파일");
    expect(ko.help).toBe("도움말");
    expect(ko.statusPanel).toBe("상태");
    expect(en.projectPanel).toBe("Project Panel");
    expect(en.spritesPanel).toBe("Sprites Panel");
    expect(en.statusPanel).toBe("Status");
    expect(en.resetLayout).toBe("Reset Layout");
    expect(en.resetWorkspace).toBe("Reset Workspace");
    expect(en.resetPanelSizes).toBe("Reset Panel Sizes");
    expect(en.resetFilters).toBe("Reset Filters");
    expect(en.troubleshooting).toBe("Troubleshooting");
    expect(en.clearCache).toBe("Clear Cache");
    expect(en.cleanRecentItems).toBe("Clean Recent Items");
    expect(en.openOutputFolder).toBeTruthy();
    expect(JSON.stringify(en)).not.toContain("Diagnostics");
    expect(JSON.stringify(ko)).not.toContain("진단");
  });

  it("uses the package app version for the editor version IPC", async () => {
    const manifest = JSON.parse(await fs.readFile(path.join(process.cwd(), "package.json"), "utf8")) as { version: string };
    const main = await fs.readFile(path.join(process.cwd(), "src/electron/main.ts"), "utf8");

    expect(manifest.version).toBe("0.1.5");
    expect(main).toContain('ipcMain.handle("app:getVersion", async () => getAppVersion())');
    expect(main).toContain("readPackageVersion");
    expect(main).toContain("app.getVersion()");
    expect(main).not.toContain("process.versions.electron");
  });

  it("calculates preview empty state reasons for the editor", () => {
    expect(getPreviewEmptyReason({ hasInput: false, hasOutput: false, spriteCount: 0, hasAtlas: false, hasError: false })).toBe("input");
    expect(getPreviewEmptyReason({ hasInput: true, hasOutput: false, spriteCount: 0, hasAtlas: false, hasError: false })).toBe("output");
    expect(getPreviewEmptyReason({ hasInput: true, hasOutput: true, spriteCount: 0, hasAtlas: false, hasError: false })).toBe("sprites");
    expect(getPreviewEmptyReason({ hasInput: true, hasOutput: true, spriteCount: 2, hasAtlas: false, hasError: false })).toBe("atlas");
    expect(getPreviewEmptyReason({ hasInput: true, hasOutput: true, spriteCount: 2, hasAtlas: true, hasError: false })).toBe("none");
    expect(getPreviewEmptyReason({ hasInput: true, hasOutput: true, spriteCount: 2, hasAtlas: true, hasError: true })).toBe("error");
    expect(getPreviewEmptyAction("input")).toBe("select-input");
    expect(getPreviewEmptyAction("output")).toBe("select-output");
    expect(getPreviewEmptyAction("sprites")).toBe("export");
    expect(getPreviewEmptyAction("atlas")).toBe("export");
    expect(getPreviewEmptyAction("error")).toBe("status");
  });

  it("keeps the first-run preview empty state focused and unnumbered", async () => {
    const en = JSON.parse(await fs.readFile(path.join(process.cwd(), "src/shared/i18n/locales/en/preview.json"), "utf8"));
    const ko = JSON.parse(await fs.readFile(path.join(process.cwd(), "src/shared/i18n/locales/ko/preview.json"), "utf8"));

    expect(en.empty.title).toBe("Create an atlas");
    expect(ko.empty.title).toBe("아틀라스를 만들어 보세요");
    expect(en.quickStart.title).toBe("Quick Start");
    expect(ko.quickStart.title).toBe("빠른 시작");
    expect(en.empty.input).toBe("Choose a PNG folder");
    expect(en.empty.output).toBe("Choose an output folder");
    expect(en.empty.scanOrExport).toBe("Export");
    expect(en.empty.openSample).toBe("Open Sample");
    expect(ko.empty.input).toBe("PNG 폴더 선택");
    expect(ko.empty.output).toBe("출력 폴더 선택");
    expect(ko.empty.scanOrExport).toBe("내보내기");
    expect([en.empty.input, en.empty.output, en.empty.scanOrExport, ko.empty.input, ko.empty.output, ko.empty.scanOrExport])
      .toEqual(expect.not.arrayContaining([expect.stringMatching(/^\d+\./)]));
  });

  it("keeps i18n and UI layout fields out of project and atlas JSON", async () => {
    const settings = normalizeGuiSettings({
      ...DEFAULT_GUI_SETTINGS,
      inputDir: "input",
      outputDir: "output",
      language: "ko",
      advancedCollapsed: false,
      logCollapsed: false,
      rightPanelTab: "batch",
      useRecommendedSettings: true,
      recentInputDirs: ["input"],
      recentOutputDirs: ["output"]
    });
    const project = createProjectFile(settings);

    expect(JSON.stringify(project)).not.toContain("language");
    expect(JSON.stringify(project)).not.toContain("rightPanelTab");
    expect(JSON.stringify(project)).not.toContain("layout");
    expect(JSON.stringify(project)).not.toContain("leftPanelWidth");
    expect(JSON.stringify(project)).not.toContain("statusPanelOpen");
    expect(JSON.stringify(project)).not.toContain("bottomStatusHeight");
    expect(JSON.stringify(project)).not.toContain("useRecommendedSettings");
    expect(JSON.stringify(project)).not.toContain("recentInputDirs");
    expect(JSON.stringify(project)).not.toContain("recentOutputDirs");

    const packResult: PackResult = {
      algorithm: "shelf",
      pages: [{ index: 0, rawWidth: 4, rawHeight: 4, width: 4, height: 4, sprites: [] }],
      sprites: [],
      logs: [],
      warnings: []
    };
    const json = buildAtlasJson("atlas", packResult);

    expect(JSON.stringify(json)).not.toContain("language");
    expect(JSON.stringify(json)).not.toContain("rightPanelTab");
    expect(JSON.stringify(json)).not.toContain("layout");
    expect(JSON.stringify(json)).not.toContain("leftPanelWidth");
    expect(JSON.stringify(json)).not.toContain("statusPanelOpen");
    expect(JSON.stringify(json)).not.toContain("bottomStatusHeight");
    expect(JSON.stringify(json)).not.toContain("useRecommendedSettings");
    expect(JSON.stringify(json)).not.toContain("recentInputDirs");
    expect(JSON.stringify(json)).not.toContain("recentOutputDirs");
    expect(JSON.stringify(json)).not.toContain("batch");
    expect(JSON.stringify(json)).not.toContain("schedule");
    expect(JSON.stringify(json)).not.toContain("release");
    expect(JSON.stringify(json)).not.toContain("validation");
    expect(JSON.stringify(json)).not.toContain("errorGuide");
    expect(JSON.stringify(json)).not.toContain("help");
  });

  it("keeps primary renderer layout text wired through i18n", async () => {
    const app = await fs.readFile(path.join(process.cwd(), "src/renderer/App.tsx"), "utf8");
    const preview = await fs.readFile(path.join(process.cwd(), "src/renderer/components/PreviewPanel.tsx"), "utf8");
    const languageSelector = await fs.readFile(path.join(process.cwd(), "src/renderer/components/i18n/LanguageSelector.tsx"), "utf8");
    const css = await fs.readFile(path.join(process.cwd(), "src/renderer/styles/app.css"), "utf8");

    expect(app).toContain("useTranslation");
    expect(app).toContain("t(\"project:panel.basic\")");
    expect(app).toContain("rightPanelTab");
    expect(app).toContain("panelToggleBar");
    expect(app).toContain("renderStatusPanel");
    expect(app).toContain("renderErrorGuide");
    expect(app).toContain("buildExportValidationDisplay");
    expect(app).toContain("sprites:tabs.batch");
    expect(app).toContain("[\"list\", \"selected\", \"filters\", \"batch\"]");
    expect(app).toContain("renderRightPanelGuide");
    expect(app).toContain("renderExportResultCard");
    expect(app).toContain("renderRecentItemsSection");
    expect(app).toContain("openSampleProject");
    expect(app).toContain("project:recommended.use");
    expect(app).toContain("project:maintenance.cacheConfirm");
    expect(app).toContain("batch:set.projectList");
    expect(app).toContain("sprites:guide.noInput");
    expect(app).toContain("simpleFilterRow");
    expect(app).not.toContain("process.versions.electron");
    expect(preview).toContain("PreviewEmptyState");
    expect(preview).toContain("t(\"preview:quickStart.title\")");
    expect(preview).toContain("t(\"preview:empty.openSample\")");
    expect(preview).toContain("t(\"preview:empty.input\")");
    expect(preview).toContain("t(\"preview:empty.choosePngFolder\")");
    expect(preview).toContain("getPreviewEmptyAction");
    expect(preview).not.toContain("onScan");
    expect(languageSelector).toContain("t(\"labels.language\")");
    expect(css).toContain("white-space: nowrap");
    expect(css).toContain("overflow: hidden");
    expect(css).toContain(".statusPanel");
    expect(css).toContain(".panelToggleBar");
    expect(css).toContain(".splitHandle");
    expect(css).toContain(".compactPanel");
    expect(css).toContain("grid-template-areas");
    expect(app).not.toContain(">Export<");
    expect(app).not.toContain(">Apply Preset<");
    expect(preview).not.toContain("Export an atlas to preview it.");
  });
});

describe("project, profile, and packaging support", () => {
  it("normalizes the project file schema without changing atlas export JSON", () => {
    const project = createProjectFile({
      ...DEFAULT_GUI_SETTINGS,
      inputDir: "C:/Game/Sprites",
      outputDir: "C:/Game/Atlas",
      name: "character_atlas",
      maxSize: 4096,
      padding: 4,
      trim: true,
      extrude: 1,
      rotate: true,
      algorithm: "maxrects",
      sizeMode: "pot",
      cache: true,
      watch: true,
      profile: "unity"
    });

    expect(project).toEqual({
      version: 1,
      name: "character_atlas",
      inputDir: "C:/Game/Sprites",
      outputDir: "C:/Game/Atlas",
      options: {
        maxSize: 4096,
        padding: 4,
        trim: true,
        extrude: 1,
        rotate: true,
        clean: true,
        algorithm: "maxrects",
        sizeMode: "pot",
        cache: true,
        watch: true
      },
      profile: "unity",
      sprites: {}
    });
  });

  it("normalizes stage 12 sprite metadata fields without changing project version", () => {
    const normalized = normalizeProjectFile({
      version: 1,
      name: "editing_project",
      inputDir: "input",
      outputDir: "output",
      profile: "unity",
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
      },
      sprites: {
        "hero.png": {
          order: 10,
          trimMode: "manual",
          crop: { x: 1, y: 2, w: 3, h: 4 }
        }
      }
    });

    expect(normalized.project.version).toBe(1);
    expect(normalized.project.sprites["hero.png"]).toMatchObject({
      order: 10,
      trimMode: "manual",
      crop: { x: 1, y: 2, w: 3, h: 4 }
    });
  });

  it("loads damaged or incomplete project data with clear defaults and warnings", () => {
    const normalized = normalizeProjectFile({
      version: 99,
      inputDir: "input",
      options: {
        maxSize: 123,
        padding: -1,
        extrude: -2
      },
      profile: "unknown"
    });

    expect(normalized.project).toMatchObject({
      version: 1,
      name: DEFAULT_GUI_SETTINGS.name,
      inputDir: "input",
      outputDir: "",
      options: {
        maxSize: DEFAULT_GUI_SETTINGS.maxSize,
        padding: DEFAULT_GUI_SETTINGS.padding,
        extrude: DEFAULT_GUI_SETTINGS.extrude,
        algorithm: "shelf",
        sizeMode: "tight",
        cache: false,
        watch: false
      },
      profile: "generic"
    });
    expect(normalized.warnings.length).toBeGreaterThan(0);
  });

  it("migrates project files without stage 8 and 9 options to defaults", () => {
    const normalized = normalizeProjectFile({
      version: 1,
      name: "old_project",
      inputDir: "input",
      outputDir: "output",
      options: {
        maxSize: 2048,
        padding: 2,
        trim: false,
        extrude: 0,
        rotate: false,
        clean: true
      },
      profile: "generic"
    });

    expect(normalized.project.options.algorithm).toBe("shelf");
    expect(normalized.project.options.sizeMode).toBe("tight");
    expect(normalized.project.options.cache).toBe(false);
    expect(normalized.project.options.watch).toBe(false);
  });


  it("converts project files back into GUI settings", () => {
    const project = normalizeProjectFile({
      version: 1,
      name: "ui_atlas",
      inputDir: "input",
      outputDir: "output",
      options: {
        maxSize: 2048,
        padding: 2,
        trim: true,
        extrude: 1,
        rotate: false,
        clean: false,
        algorithm: "maxrects",
        sizeMode: "pot",
        cache: true,
        watch: true
      },
      profile: "monogame"
    }).project;

    expect(projectToSettings(project)).toMatchObject({
      inputDir: "input",
      outputDir: "output",
      name: "ui_atlas",
      trim: true,
      clean: false,
      profile: "monogame",
      algorithm: "maxrects",
      sizeMode: "pot",
      cache: true,
      watch: true
    });
  });

  it("provides generic, Unity, and MonoGame profile presets", () => {
    expect(PROFILE_PRESETS.map((preset) => preset.id)).toEqual(["generic", "unity", "monogame"]);
    expect(applyProfilePreset(DEFAULT_GUI_SETTINGS, "generic")).toMatchObject({
      trim: true,
      extrude: 1,
      rotate: false,
      algorithm: "maxrects",
      sizeMode: "tight",
      cache: false,
      watch: false,
      profile: "generic"
    });
    expect(applyProfilePreset(DEFAULT_GUI_SETTINGS, "unity")).toMatchObject({
      trim: true,
      extrude: 1,
      rotate: true,
      algorithm: "maxrects",
      sizeMode: "pot",
      cache: true,
      watch: false,
      profile: "unity"
    });
    expect(applyProfilePreset(DEFAULT_GUI_SETTINGS, "monogame")).toMatchObject({
      trim: true,
      extrude: 1,
      rotate: false,
      algorithm: "maxrects",
      sizeMode: "pot",
      cache: true,
      watch: false,
      profile: "monogame"
    });
  });

  it("localizes recommended settings descriptions for every profile", async () => {
    const en = JSON.parse(await fs.readFile(path.join(process.cwd(), "src/shared/i18n/locales/en/project.json"), "utf8"));
    const ko = JSON.parse(await fs.readFile(path.join(process.cwd(), "src/shared/i18n/locales/ko/project.json"), "utf8"));

    for (const preset of PROFILE_PRESETS) {
      expect(en.recommended.hint[preset.id]).toBeTruthy();
      expect(ko.recommended.hint[preset.id]).toBeTruthy();
    }
    expect(en.recommended.apply).toBe("Apply Recommended Settings");
    expect(ko.recommended.apply).toBe("추천 설정 적용");
  });

  it("deduplicates, sorts, and caps recent project paths", () => {
    const paths = Array.from({ length: 12 }, (_, index) => `C:/Project/${index}.suwol-atlas.json`);
    const withRecent = paths.reduce((recent, filePath) => addRecentProjectPath(recent, filePath), [] as string[]);
    const deduped = addRecentProjectPath(withRecent, "C:/Project/5.suwol-atlas.json");

    expect(deduped).toHaveLength(10);
    expect(deduped[0]).toBe("C:/Project/5.suwol-atlas.json");
    expect(new Set(deduped.map((item) => item.toLowerCase())).size).toBe(deduped.length);
  });

  it("deduplicates, sorts, and caps generic recent paths for projects and folders", () => {
    const paths = Array.from({ length: 12 }, (_, index) => `C:/Folder/${index}`);
    const recent = paths.reduce((current, filePath) => addRecentPath(current, filePath), [] as string[]);
    const deduped = addRecentPath(recent, "C:/Folder/5");

    expect(deduped).toHaveLength(10);
    expect(deduped[0]).toBe("C:/Folder/5");
    expect(new Set(deduped.map((item) => item.toLowerCase())).size).toBe(deduped.length);
  });

  it("detects dirty project state after option changes and clears after save snapshot updates", () => {
    const saved = createProjectFile(DEFAULT_GUI_SETTINGS);
    const changed = normalizeGuiSettings({
      ...DEFAULT_GUI_SETTINGS,
      padding: 8
    });

    expect(isProjectDirty(DEFAULT_GUI_SETTINGS, saved)).toBe(false);
    expect(isProjectDirty(changed, saved)).toBe(true);
    expect(isProjectDirty(changed, createProjectFile(changed))).toBe(false);
  });

  it("normalizes batch set files with manual schedule metadata", () => {
    const batchSet = createBatchSet("Release QA", [
      "projects/a.suwol-atlas.json",
      "projects/a.suwol-atlas.json",
      "projects/b.suwol-atlas.json"
    ], {
      failFast: true,
      schedule: {
        enabled: true,
        mode: "manual",
        note: "Friday QA"
      }
    });
    const normalized = normalizeBatchSet({
      version: 99,
      name: "  Release QA  ",
      projects: batchSet.projects,
      options: { failFast: true },
      schedule: { enabled: true, mode: "daily", note: " Friday QA " }
    });

    expect(batchSet).toMatchObject({
      version: 1,
      name: "Release QA",
      projects: ["projects/a.suwol-atlas.json", "projects/b.suwol-atlas.json"],
      options: { failFast: true },
      schedule: { enabled: true, mode: "manual", note: "Friday QA" }
    });
    expect(normalized.warnings[0]).toContain("Unsupported batch set version");
    expect(normalized.batchSet.schedule).toEqual({ enabled: true, mode: "manual", note: "Friday QA" });
    expect(ensureBatchSetExtension("release/qa")).toBe(`release/qa${BATCH_SET_FILE_EXTENSION}`);
  });

  it("keeps batch set manual-run UX strings and disabled schedule message localized", async () => {
    const en = JSON.parse(await fs.readFile(path.join(process.cwd(), "src/shared/i18n/locales/en/batch.json"), "utf8"));
    const ko = JSON.parse(await fs.readFile(path.join(process.cwd(), "src/shared/i18n/locales/ko/batch.json"), "utf8"));
    const app = await fs.readFile(path.join(process.cwd(), "src/renderer/App.tsx"), "utf8");

    expect(en.set.projectList).toBe("Project list");
    expect(en.set.addProject).toBe("Add Project");
    expect(en.set.removeProject).toBe("Remove Project");
    expect(en.set.scheduleUnsupported).toBe("Scheduled runs are not supported yet.");
    expect(ko.set.scheduleUnsupported).toBe("예약 실행은 아직 지원하지 않습니다.");
    expect(app).toContain("addBatchSetProjects");
    expect(app).toContain("removeBatchSetProject");
    expect(app).toContain("batch:set.scheduleUnsupported");
  });

  it("exports multiple project files in a batch and continues after failures", async () => {
    const root = await createTempDir();
    const inputA = path.join(root, "input-a");
    const inputB = path.join(root, "input-b");
    const outputA = path.join(root, "output-a");
    const outputB = path.join(root, "output-b");
    const projectsDir = path.join(root, "projects");
    await writeTestPng(path.join(inputA, "hero.png"), 4, 4, [255, 0, 0, 255]);
    await writeTestPng(path.join(inputB, "coin.png"), 3, 3, [255, 255, 0, 255]);
    await fs.mkdir(projectsDir, { recursive: true });
    await fs.writeFile(
      path.join(projectsDir, "a.suwol-atlas.json"),
      `${JSON.stringify(createProjectFile({
        ...DEFAULT_GUI_SETTINGS,
        inputDir: path.relative(projectsDir, inputA),
        outputDir: path.relative(projectsDir, outputA),
        name: "atlas_a",
        cache: true
      }), null, 2)}\n`,
      "utf8"
    );
    await fs.writeFile(
      path.join(projectsDir, "b.suwol-atlas.json"),
      `${JSON.stringify(createProjectFile({
        ...DEFAULT_GUI_SETTINGS,
        inputDir: path.relative(projectsDir, inputB),
        outputDir: path.relative(projectsDir, outputB),
        name: "atlas_b",
        sizeMode: "pot"
      }), null, 2)}\n`,
      "utf8"
    );
    await fs.writeFile(
      path.join(projectsDir, "broken.suwol-atlas.json"),
      JSON.stringify({
        version: 1,
        name: "broken",
        inputDir: "missing",
        outputDir: "out",
        options: {
          maxSize: 2048,
          padding: 2,
          trim: false,
          extrude: 0,
          rotate: false,
          clean: true
        },
        profile: "generic"
      }),
      "utf8"
    );

    const result = await batchExport([projectsDir]);

    expect(result.total).toBe(3);
    expect(result.succeeded).toBe(2);
    expect(result.failed).toBe(1);
    expect(await exists(path.join(outputA, "atlas_a.json"))).toBe(true);
    expect(await exists(path.join(outputB, "atlas_b.json"))).toBe(true);
  });

  it("coalesces multiple watch triggers into one debounced export", async () => {
    vi.useFakeTimers();
    const runs: string[] = [];
    const queue = new DebouncedExportQueue({
      debounceMs: 100,
      run: async (reason: string) => {
        runs.push(reason);
        return reason;
      }
    });

    queue.trigger("first");
    queue.trigger("second");
    await vi.advanceTimersByTimeAsync(99);
    expect(runs).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(runs).toEqual(["second"]);
    queue.close();
    vi.useRealTimers();
  });

  it("calculates selected sprite preview rects with zoom and page filtering", () => {
    const page = { image: "multi_1.png", width: 100, height: 80 };
    const sprite = {
      name: "hero",
      page: 1,
      x: 10,
      y: 12,
      w: 20,
      h: 8,
      rotated: false,
      trimmed: false,
      sourceW: 20,
      sourceH: 8,
      offsetX: 0,
      offsetY: 0,
      pivotX: 0.5,
      pivotY: 0.5
    };

    expect(calculateSpritePreviewRect(sprite, page, 1, 2)).toEqual({
      left: 20,
      top: 24,
      width: 40,
      height: 16
    });
    expect(calculateSpritePreviewRect(sprite, page, 0, 2)).toBeNull();
  });

  it("includes Windows packaging metadata, icon paths, and scripts", async () => {
    const manifest = JSON.parse(await fs.readFile(path.join(process.cwd(), "package.json"), "utf8"));
    const lock = JSON.parse(await fs.readFile(path.join(process.cwd(), "package-lock.json"), "utf8"));

    expect(manifest.productName).toBe("Suwol Atlas Maker");
    expect(manifest.version).toBe("0.1.5");
    expect(lock.version).toBe("0.1.5");
    expect(lock.packages[""].version).toBe("0.1.5");
    expect(manifest.main).toBe("dist/electron/main.js");
    expect(manifest.scripts).toHaveProperty("release:verify");
    expect(manifest.scripts).toHaveProperty("release:zip:win");
    expect(manifest.scripts["release:verify"]).toContain("npm run i18n:check");
    expect(manifest.scripts["release:verify"]).toContain("npm run verify:release:zip:win");
    expect(manifest.scripts).toHaveProperty("pack:win");
    expect(manifest.scripts).toHaveProperty("pack:linux");
    expect(manifest.scripts).toHaveProperty("zip:win");
    expect(manifest.scripts).toHaveProperty("zip:linux");
    expect(manifest.scripts).toHaveProperty("dist:zip");
    expect(manifest.scripts).toHaveProperty("check:release-version");
    expect(manifest.scripts).toHaveProperty("smoke:packaged:win");
    expect(manifest.scripts).toHaveProperty("smoke:packaged:linux");
    expect(manifest.scripts).toHaveProperty("verify:release:zip:win");
    expect(manifest.scripts).toHaveProperty("verify:release:zip:linux");
    expect(manifest.scripts).toHaveProperty("dist:win");
    expect(manifest.scripts).toHaveProperty("icons:generate");
    expect(manifest.scripts).toHaveProperty("build:preload");
    expect(manifest.scripts).toHaveProperty("copy:i18n-locales");
    expect(manifest.scripts).toHaveProperty("i18n:add");
    expect(manifest.scripts).toHaveProperty("i18n:missing");
    expect(manifest.scripts).toHaveProperty("generate:samples:editing");
    expect(manifest.scripts).toHaveProperty("sample:editing");
    expect(manifest.scripts).toHaveProperty("generate:samples:ux");
    expect(manifest.scripts).toHaveProperty("sample:ux");
    expect(manifest.build).toMatchObject({
      appId: "work.godwish.suwol-atlas-maker",
      productName: "Suwol Atlas Maker",
      artifactName: "SuwolAtlasMaker-${version}-win-${arch}.${ext}",
      win: {
        icon: "build/icon.ico"
      },
      linux: {
        icon: "build/icon.png",
        target: ["dir"],
        category: "Development"
      }
    });
    expect(manifest.devDependencies).toHaveProperty("@electron/asar");
    expect(manifest.devDependencies).toHaveProperty("archiver");
    expect(manifest.build.files).toContain("dist/core/**/*");
    expect(manifest.build.files).toContain("dist/shared/**/*");
    expect(manifest.build.files).toContain("!integrations/**");
    expect(manifest.build.files).toContain("!samples/**");
    expect(manifest.build.files).toContain("!tests/**");
    expect(manifest.build.files).toContain("!src/**");
    expect(manifest.build.files).toContain("!docs/**");
    expect(manifest.build.files).toContain("!.github/**");
  });

  it("includes GitHub Actions CI and release ZIP automation", async () => {
    const files = [
      ".github/workflows/ci.yml",
      ".github/workflows/release.yml",
      "vite.config.ts",
      "scripts/zip-release.mjs",
      "scripts/check-release-version.mjs",
      "scripts/smoke-packaged-windows.mjs",
      "scripts/smoke-packaged-linux.mjs",
      "scripts/verify-release-zip.mjs",
      "scripts/check-i18n.mjs",
      "scripts/i18n-add-locale.mjs",
      "scripts/i18n-list-missing.mjs",
      "docs/release.md",
      "docs/release-notes-0.1.5.md",
      "docs/known-issues.md",
      "docs/manual-qa.md",
      "docs/help.md",
      "docs/troubleshooting.md",
      "docs/signing.md",
      "docs/installer.md",
      "docs/batch-sets.md"
    ];

    for (const file of files) {
      expect(await exists(path.join(process.cwd(), file))).toBe(true);
    }

    const releaseWorkflow = await fs.readFile(path.join(process.cwd(), ".github/workflows/release.yml"), "utf8");
    const ciWorkflow = await fs.readFile(path.join(process.cwd(), ".github/workflows/ci.yml"), "utf8");
    const viteConfig = await fs.readFile(path.join(process.cwd(), "vite.config.ts"), "utf8");
    const zipScript = await fs.readFile(path.join(process.cwd(), "scripts/zip-release.mjs"), "utf8");
    const verifyScript = await fs.readFile(path.join(process.cwd(), "scripts/verify-release-zip.mjs"), "utf8");
    const versionScript = await fs.readFile(path.join(process.cwd(), "scripts/check-release-version.mjs"), "utf8");
    const docs = await fs.readFile(path.join(process.cwd(), "docs/release.md"), "utf8");

    expect(ciWorkflow).toContain("pull_request");
    expect(ciWorkflow).toContain("branches:");
    expect(ciWorkflow).toContain("contents: read");
    expect(ciWorkflow).toContain("windows-latest");
    expect(ciWorkflow).toContain("ubuntu-latest");
    expect(ciWorkflow).toContain("node-version: \"22\"");
    expect(ciWorkflow).toContain("npm run build:unity-check");
    expect(ciWorkflow).toContain("npm run build:monogame");
    expect(ciWorkflow).toContain("npm run build:monogame:pipeline");
    expect(ciWorkflow).toContain("npm run sample:batch");
    expect(releaseWorkflow).toContain("tags:");
    expect(releaseWorkflow).toContain("\"v*\"");
    expect(releaseWorkflow).toContain("workflow_dispatch");
    expect(releaseWorkflow).toContain("contents: write");
    expect(releaseWorkflow).toContain("build-windows");
    expect(releaseWorkflow).toContain("build-linux");
    expect(releaseWorkflow).toContain("softprops/action-gh-release@v2");
    expect(releaseWorkflow).toContain("actions/upload-artifact@v4");
    expect(releaseWorkflow).toContain("release/archives/*win-x64.zip");
    expect(releaseWorkflow).toContain("release/archives/*linux-x64.zip");
    expect(releaseWorkflow).toContain("npm run smoke:packaged:win");
    expect(releaseWorkflow).toContain("npm run smoke:packaged:linux");
    expect(releaseWorkflow).not.toContain("npm run build:unity-check");
    expect(releaseWorkflow).not.toContain("npm run build:monogame");
    expect(releaseWorkflow).not.toContain("npm run build:monogame:pipeline");
    expect(releaseWorkflow).not.toContain("npm run sample");
    expect(zipScript).toContain("verifyReleasePackage");
    expect(viteConfig).toContain('base: "./"');
    expect(verifyScript).toContain("SuwolAtlasMaker-${version}-${platform}-x64.zip");
    expect(verifyScript).toContain("forbiddenTopLevelEntries");
    expect(verifyScript).toContain("Renderer asset URLs must be relative");
    expect(verifyScript).toContain("Required i18n locale file");
    expect(verifyScript).toContain("dist/shared/i18n/locales/en/common.json");
    expect(verifyScript).toContain("app.asar");
    expect(verifyScript).toContain("integrations");
    expect(verifyScript).toContain("samples");
    expect(verifyScript).toContain("src");
    expect(versionScript).toContain("refs/tags/v${version}");
    expect(versionScript).toContain("RELEASE_TAG");
    expect(docs).toContain("SuwolAtlasMaker-${version}-win-x64.zip");
    expect(docs).toContain("SuwolAtlasMaker-${version}-linux-x64.zip");
    expect(docs).toContain("editor-only");
    expect(docs).toContain("i18n locale files");
  });

  it("includes generated brand icon assets", async () => {
    const files = [
      "assets/brand/icon-source.png",
      "assets/brand/icon.svg",
      "assets/brand/icon-256.png",
      "assets/brand/icon-512.png",
      "build/icon.ico",
      "build/icon.png"
    ];

    for (const file of files) {
      expect(await exists(path.join(process.cwd(), file))).toBe(true);
    }
  });

  it("keeps Electron security options enabled", async () => {
    const mainProcess = await fs.readFile(path.join(process.cwd(), "src/electron/main.ts"), "utf8");
    const preload = await fs.readFile(path.join(process.cwd(), "src/electron/preload.ts"), "utf8");

    expect(mainProcess).toContain("contextIsolation: true");
    expect(mainProcess).toContain("nodeIntegration: false");
    expect(preload).toContain("contextBridge.exposeInMainWorld");
    expect(mainProcess).toContain("Menu.setApplicationMenu");
  });
});

describe("CLI option parsing", () => {
  it("accepts supported packing algorithms", () => {
    expect(parsePackingAlgorithmOption("shelf")).toBe("shelf");
    expect(parsePackingAlgorithmOption("maxrects")).toBe("maxrects");
  });

  it("rejects unsupported packing algorithms", () => {
    expect(() => parsePackingAlgorithmOption("grid")).toThrow(/shelf.*maxrects/);
  });

  it("accepts supported size modes", () => {
    expect(parseSizeModeOption("tight")).toBe("tight");
    expect(parseSizeModeOption("pot")).toBe("pot");
    expect(parseSizeModeOption("square-pot")).toBe("square-pot");
  });

  it("rejects unsupported size modes", () => {
    expect(() => parseSizeModeOption("square")).toThrow(/tight.*pot.*square-pot/);
  });

  it("accepts zero extrude", () => {
    expect(parseNonNegativeInteger("0")).toBe(0);
  });

  it("rejects negative extrude", () => {
    expect(() => parseNonNegativeInteger("-1")).toThrow(/non-negative integer/);
  });

  it("rejects decimal extrude", () => {
    expect(() => parseNonNegativeInteger("1.5")).toThrow(/non-negative integer/);
  });

  it("rejects text extrude", () => {
    expect(() => parseNonNegativeInteger("abc")).toThrow(/non-negative integer/);
  });
});

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "suwol-atlas-maker-"));
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(directory: string, extension: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listFiles(entryPath, extension)));
    } else if (entry.name.endsWith(extension)) {
      files.push(entryPath);
    }
  }

  return files;
}

async function writeTestPng(
  filePath: string,
  width: number,
  height: number,
  color: Color
): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const png = makeSolidPng(width, height, color);
  await fs.writeFile(filePath, PNG.sync.write(png));
}

function packLoadedImages(
  images: LoadedImage[],
  options: Partial<PackOptions> & { trim?: boolean } = {}
): PackResult {
  const sprites = prepareImages(images, { trim: options.trim ?? false });

  return packWithFactory(sprites, defaultPackOptions(options));
}

function defaultPackOptions(options: Partial<PackOptions> = {}): PackOptions {
  return {
    maxSize: options.maxSize ?? 64,
    padding: options.padding ?? 0,
    extrude: options.extrude ?? 0,
    rotate: options.rotate ?? false,
    algorithm: options.algorithm ?? "shelf"
  };
}

function createLoadedImage(name: string, png: PNG): LoadedImage {
  return {
    name,
    filePath: path.join("memory", `${name}.png`),
    width: png.width,
    height: png.height,
    png
  };
}

function makeGuiScanItem(
  relativePath: string,
  patch: Partial<GuiInputSpriteScanItem> = {}
): GuiInputSpriteScanItem {
  const originalName = path.basename(relativePath, ".png");

  return {
    relativePath,
    originalName,
    width: 4,
    height: 4,
    sourceW: 4,
    sourceH: 4,
    autoTrimRect: { x: 1, y: 1, w: 2, h: 2 },
    hasMetadata: false,
    include: true,
    exportName: originalName,
    pivotX: 0.5,
    pivotY: 0.5,
    tags: [],
    group: "",
    trimMode: "default",
    cropValid: true,
    status: "included",
    ...patch
  };
}

function makeSolidPng(width: number, height: number, color: Color): PNG {
  const png = new PNG({ width, height });

  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = color[0];
    png.data[i + 1] = color[1];
    png.data[i + 2] = color[2];
    png.data[i + 3] = color[3];
  }

  return png;
}

function makeTransparentPng(width: number, height: number): PNG {
  return makeSolidPng(width, height, [0, 0, 0, 0]);
}

function makeTransparentBorderPng(
  width: number,
  height: number,
  rectX: number,
  rectY: number,
  rectW: number,
  rectH: number
): PNG {
  const png = makeTransparentPng(width, height);
  const content = makeSolidPng(rectW, rectH, [255, 0, 0, 255]);
  setRect(png, rectX, rectY, content);
  return png;
}

function makeQuadPng(): PNG {
  const png = new PNG({ width: 2, height: 2 });
  setPixel(png, 0, 0, [255, 0, 0, 255]);
  setPixel(png, 1, 0, [0, 255, 0, 255]);
  setPixel(png, 0, 1, [0, 0, 255, 255]);
  setPixel(png, 1, 1, [255, 255, 0, 255]);
  return png;
}

function makePatternPng(width: number, height: number): PNG {
  const colors: Color[] = [
    [255, 0, 0, 255],
    [0, 255, 0, 255],
    [0, 0, 255, 255],
    [255, 255, 0, 255],
    [0, 255, 255, 255],
    [255, 0, 255, 255],
    [255, 128, 0, 255],
    [128, 0, 255, 255]
  ];
  const png = new PNG({ width, height });

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      setPixel(png, x, y, colors[(y * width + x) % colors.length]);
    }
  }

  return png;
}

function setRect(target: PNG, x: number, y: number, source: PNG): void {
  for (let row = 0; row < source.height; row += 1) {
    for (let column = 0; column < source.width; column += 1) {
      setPixel(target, x + column, y + row, readPixel(source, column, row));
    }
  }
}

function setPixel(png: PNG, x: number, y: number, color: Color): void {
  const index = (y * png.width + x) * 4;
  png.data[index] = color[0];
  png.data[index + 1] = color[1];
  png.data[index + 2] = color[2];
  png.data[index + 3] = color[3];
}

function readPixel(png: PNG, x: number, y: number): Color {
  const index = (y * png.width + x) * 4;
  return [png.data[index], png.data[index + 1], png.data[index + 2], png.data[index + 3]];
}

function flattenLocaleKeys(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }

  return Object.entries(value)
    .flatMap(([key, child]) => flattenLocaleKeys(child, prefix ? `${prefix}.${key}` : key))
    .sort();
}

function localeStringValues(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  return Object.values(value).flatMap((child) => localeStringValues(child));
}
