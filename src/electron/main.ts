import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  shell,
  type MenuItemConstructorOptions,
  type OpenDialogOptions,
  type SaveDialogOptions
} from "electron";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PNG } from "pngjs";
import { batchExport } from "../core/batch/batchExport.js";
import { loadPngImages } from "../core/image/pngLoader.js";
import { findAutoTrimCrop } from "../core/image/preprocess.js";
import { makeAtlas } from "../core/makeAtlas.js";
import type { NormalizedSpriteMetadata, SpriteMetadataEntry, SpriteTrimMode } from "../core/metadata/metadataTypes.js";
import { normalizeMetadataPathKey, normalizeSpriteMetadataEntry, validateAndResolveSpriteMetadata } from "../core/metadata/spriteMetadata.js";
import { watchAtlas, type AtlasWatcher } from "../core/watch/watchAtlas.js";
import { describeError, SuwolAtlasError } from "../shared/errors.js";
import type {
  GuiAtlasJson,
  GuiAtlasPagePreview,
  GuiBatchExportOptions,
  GuiBatchExportResult,
  GuiBatchSetLoadResult,
  GuiBatchSetRunRequest,
  GuiBatchSetSaveRequest,
  GuiBatchSetSaveResult,
  GuiExportOptions,
  GuiExportResult,
  GuiInputSpriteScanItem,
  GuiProjectFile,
  GuiProjectLoadResult,
  GuiProjectSaveRequest,
  GuiProjectSaveResult,
  GuiSourceImagePreview,
  GuiSourcePreviewRequest,
  GuiSettings,
  GuiWatchEvent
} from "../shared/gui-types.js";
import { withoutExtension } from "../shared/paths.js";
import { resolveInputRelativePath } from "../shared/source-preview-security.js";
import {
  DEFAULT_GUI_SETTINGS,
  normalizeGuiSettings,
  toCoreMakeAtlasOptions,
  validateGuiExportOptions,
  validateSpriteCropRect
} from "../shared/gui-utils.js";
import {
  BATCH_SET_FILE_EXTENSION,
  createBatchSet,
  ensureBatchSetExtension,
  normalizeBatchSet,
  type GuiBatchSet
} from "../shared/batch-set.js";
import { getMenuLabels } from "../shared/i18n/menu.js";
import { normalizeAppLanguage } from "../shared/i18n/language.js";
import type { AppLanguage } from "../shared/i18n/types.js";
import {
  addRecentProjectPath,
  createProjectFile,
  PROJECT_FILE_EXTENSION,
  normalizeProjectFile,
  removeRecentProjectPath
} from "../shared/project.js";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const settingsFileName = "suwol-atlas-maker-settings.json";

let mainWindow: BrowserWindow | null = null;
let guiWatcher: AtlasWatcher | null = null;

app.whenReady().then(async () => {
  await rebuildApplicationMenu();
  await createMainWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

registerIpcHandlers();

async function createMainWindow(): Promise<void> {
  const settings = await loadSettings();

  mainWindow = new BrowserWindow({
    width: settings.windowWidth,
    height: settings.windowHeight,
    minWidth: 980,
    minHeight: 680,
    title: "Suwol Atlas Maker",
    icon: getWindowIconPath(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(currentDir, "preload.cjs")
    }
  });

  mainWindow.on("close", () => {
    void saveWindowSize(mainWindow);
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;

  if (devServerUrl) {
    await mainWindow.loadURL(devServerUrl);
  } else {
    await mainWindow.loadFile(path.join(currentDir, "../renderer/index.html"));
  }
}

function registerIpcHandlers(): void {
  ipcMain.handle("dialog:selectInputDirectory", async () => selectDirectory("Select input folder"));
  ipcMain.handle("dialog:selectOutputDirectory", async () => selectDirectory("Select output folder"));

  ipcMain.handle("atlas:export", async (_event, options: GuiExportOptions) => {
    try {
      return await exportAtlas(options);
    } catch (error) {
      throw new Error(describeError(error));
    }
  });

  ipcMain.handle("atlas:scanInput", async (_event, options: GuiExportOptions) => scanInput(options));
  ipcMain.handle("atlas:getSourceImagePreview", async (_event, request: GuiSourcePreviewRequest) => getSourceImagePreview(request));
  ipcMain.handle("atlas:computeAutoTrimRect", async (_event, request: GuiSourcePreviewRequest) => computeAutoTrimRect(request));
  ipcMain.handle("atlas:validateSpriteCrop", async (_event, request: { sourceW: number; sourceH: number; crop?: { x: number; y: number; w: number; h: number } }) =>
    validateSpriteCropRect(request.crop, request.sourceW, request.sourceH));
  ipcMain.handle("atlas:readJson", async (_event, filePath: string) => readJson(filePath));
  ipcMain.handle("atlas:readLog", async (_event, filePath: string) => readTextFile(filePath));
  ipcMain.handle("atlas:openOutputDirectory", async (_event, directoryPath: string) => openOutputDirectory(directoryPath));
  ipcMain.handle("batch:selectTargets", async () => selectBatchTargets());
  ipcMain.handle("batch:export", async (_event, paths: string[], options?: GuiBatchExportOptions) => runBatchExport(paths, options));
  ipcMain.handle("batchSet:openDialog", async () => openBatchSetDialog());
  ipcMain.handle("batchSet:save", async (_event, request: GuiBatchSetSaveRequest) => saveBatchSet(request));
  ipcMain.handle("batchSet:saveAs", async (_event, request: GuiBatchSetSaveRequest) => saveBatchSetAs(request));
  ipcMain.handle("batchSet:run", async (_event, request: GuiBatchSetRunRequest) => runBatchSet(request));
  ipcMain.handle("watch:start", async (_event, options: GuiExportOptions) => startGuiWatch(options));
  ipcMain.handle("watch:stop", async () => stopGuiWatch());
  ipcMain.handle("settings:load", async () => loadSettings());
  ipcMain.handle("settings:save", async (_event, settings: GuiSettings) => {
    await saveSettings(settings);
  });
  ipcMain.handle("project:new", async () => createProjectFile(DEFAULT_GUI_SETTINGS));
  ipcMain.handle("project:openDialog", async () => openProjectDialog());
  ipcMain.handle("project:save", async (_event, request: GuiProjectSaveRequest) => saveProject(request));
  ipcMain.handle("project:saveAs", async (_event, request: GuiProjectSaveRequest) => saveProjectAs(request));
  ipcMain.handle("project:loadFromPath", async (_event, filePath: string) => loadProjectFromPath(filePath));
  ipcMain.handle("recent:list", async () => listRecentProjects());
  ipcMain.handle("recent:open", async (_event, filePath: string) => openRecentProject(filePath));
  ipcMain.handle("app:getVersion", async () => app.getVersion());
  ipcMain.handle("app:getLanguage", async () => (await loadSettings()).language);
  ipcMain.handle("app:setLanguage", async (_event, language: AppLanguage) => {
    const settings = await loadSettings();
    const normalizedLanguage = normalizeAppLanguage(language);

    await saveSettings({
      ...settings,
      language: normalizedLanguage
    });
    await rebuildApplicationMenu(normalizedLanguage);
  });
  ipcMain.handle("app:rebuildMenu", async () => rebuildApplicationMenu());
}

async function rebuildApplicationMenu(languageOverride?: AppLanguage): Promise<void> {
  const language = languageOverride ?? (await loadSettings()).language;
  createApplicationMenu(language);
}

function createApplicationMenu(language: AppLanguage): void {
  const labels = getMenuLabels(language, app.getLocale());
  const template: MenuItemConstructorOptions[] = [
    {
      label: labels.file,
      submenu: [
        { label: labels.newProject, accelerator: "CmdOrCtrl+N", click: () => sendMenuCommand("project:new") },
        { label: labels.openProject, accelerator: "CmdOrCtrl+O", click: () => sendMenuCommand("project:open") },
        { label: labels.saveProject, accelerator: "CmdOrCtrl+S", click: () => sendMenuCommand("project:save") },
        { label: labels.saveProjectAs, accelerator: "CmdOrCtrl+Shift+S", click: () => sendMenuCommand("project:saveAs") },
        { type: "separator" },
        { label: labels.batchExport, click: () => sendMenuCommand("batch:export") },
        { type: "separator" },
        { label: labels.openOutputFolder, click: () => sendMenuCommand("output:open") },
        { type: "separator" },
        { role: "quit" }
      ]
    },
    {
      label: labels.edit,
      submenu: [
        { label: labels.undo, accelerator: "CmdOrCtrl+Z", click: () => sendMenuCommand("edit:undo") },
        { label: labels.redo, accelerator: process.platform === "darwin" ? "CmdOrCtrl+Shift+Z" : "CmdOrCtrl+Y", click: () => sendMenuCommand("edit:redo") }
      ]
    },
    {
      label: labels.view,
      submenu: [
        { label: labels.reload, role: "reload" },
        { label: labels.toggleDevTools, role: "toggleDevTools" }
      ]
    },
    {
      label: labels.help,
      submenu: [
        { label: labels.about, click: () => void showAboutDialog(language) }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function selectBatchTargets(): Promise<string[] | null> {
  const options: OpenDialogOptions = {
    title: "Select Suwol Atlas Maker projects or folders",
    properties: ["openFile", "openDirectory", "multiSelections"],
    filters: [
      { name: "Suwol Atlas Maker Project", extensions: ["suwol-atlas.json"] },
      { name: "JSON", extensions: ["json"] }
    ]
  };
  const result = mainWindow
    ? await dialog.showOpenDialog(mainWindow, options)
    : await dialog.showOpenDialog(options);

  return result.canceled || result.filePaths.length === 0 ? null : result.filePaths;
}

async function openBatchSetDialog(): Promise<GuiBatchSetLoadResult | null> {
  const options: OpenDialogOptions = {
    title: "Open Suwol Atlas Maker batch set",
    properties: ["openFile"],
    filters: [
      { name: "Suwol Atlas Maker Batch Set", extensions: ["suwol-atlas-batch.json"] },
      { name: "JSON", extensions: ["json"] }
    ]
  };
  const result = mainWindow
    ? await dialog.showOpenDialog(mainWindow, options)
    : await dialog.showOpenDialog(options);

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return loadBatchSetFromPath(result.filePaths[0]);
}

async function loadBatchSetFromPath(filePath: string): Promise<GuiBatchSetLoadResult> {
  try {
    const text = await fs.readFile(filePath, "utf8");
    const { batchSet, warnings } = normalizeBatchSet(JSON.parse(text));

    return {
      path: filePath,
      batchSet,
      warnings
    };
  } catch (error) {
    throw new Error(`Failed to load batch set "${filePath}": ${describeError(error)}`);
  }
}

async function saveBatchSet(request: GuiBatchSetSaveRequest): Promise<GuiBatchSetSaveResult> {
  if (!request.path) {
    throw new Error("Batch set path is required. Use Save Batch Set As first.");
  }

  const filePath = ensureBatchSetExtension(request.path);
  const { batchSet } = normalizeBatchSet(request.batchSet);
  const savedBatchSet = toSavedBatchSet(batchSet, filePath);

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(savedBatchSet, null, 2)}\n`, "utf8");

  return {
    path: filePath,
    batchSet: savedBatchSet
  };
}

async function saveBatchSetAs(request: GuiBatchSetSaveRequest): Promise<GuiBatchSetSaveResult | null> {
  const { batchSet } = normalizeBatchSet(request.batchSet);
  const options: SaveDialogOptions = {
    title: "Save Suwol Atlas Maker batch set",
    defaultPath: request.path ?? `${batchSet.name}${BATCH_SET_FILE_EXTENSION}`,
    filters: [
      { name: "Suwol Atlas Maker Batch Set", extensions: ["suwol-atlas-batch.json"] },
      { name: "JSON", extensions: ["json"] }
    ]
  };
  const result = mainWindow
    ? await dialog.showSaveDialog(mainWindow, options)
    : await dialog.showSaveDialog(options);

  if (result.canceled || !result.filePath) {
    return null;
  }

  return saveBatchSet({
    path: result.filePath,
    batchSet
  });
}

async function runBatchSet(request: GuiBatchSetRunRequest): Promise<GuiBatchExportResult> {
  const { batchSet } = normalizeBatchSet(request.batchSet);
  const projects = resolveBatchSetProjectPaths(batchSet, request.path);

  if (projects.length === 0) {
    throw new Error("Batch set has no projects to export.");
  }

  return runBatchExport(projects, {
    failFast: batchSet.options.failFast
  });
}

function toSavedBatchSet(batchSet: GuiBatchSet, batchSetPath: string): GuiBatchSet {
  const baseDir = path.dirname(batchSetPath);

  return createBatchSet(batchSet.name, batchSet.projects.map((projectPath) => {
    if (!path.isAbsolute(projectPath)) {
      return projectPath;
    }

    const relative = path.relative(baseDir, projectPath);
    return relative && !relative.startsWith("..") && !path.isAbsolute(relative)
      ? relative.replace(/\\/g, "/")
      : projectPath.replace(/\\/g, "/");
  }), {
    failFast: batchSet.options.failFast,
    schedule: batchSet.schedule
  });
}

function resolveBatchSetProjectPaths(batchSet: GuiBatchSet, batchSetPath?: string | null): string[] {
  const baseDir = batchSetPath ? path.dirname(batchSetPath) : process.cwd();

  return batchSet.projects.map((projectPath) => {
    const nativePath = projectPath.replace(/\//g, path.sep);
    return path.isAbsolute(nativePath) ? nativePath : path.resolve(baseDir, nativePath);
  });
}

function sendMenuCommand(command: string): void {
  mainWindow?.webContents.send("menu:command", command);
}

async function showAboutDialog(language?: AppLanguage): Promise<void> {
  const labels = getMenuLabels(language ?? (await loadSettings()).language, app.getLocale());
  const options = {
    type: "info" as const,
    title: labels.aboutTitle,
    message: "Suwol Atlas Maker",
    detail: `Version ${app.getVersion()}\n\n${labels.aboutDetail}`
  };

  if (mainWindow) {
    await dialog.showMessageBox(mainWindow, options);
  } else {
    await dialog.showMessageBox(options);
  }
}

async function selectDirectory(title: string): Promise<string | null> {
  const options: OpenDialogOptions = {
    title,
    properties: ["openDirectory", "createDirectory"]
  };
  const result = mainWindow
    ? await dialog.showOpenDialog(mainWindow, options)
    : await dialog.showOpenDialog(options);

  return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
}

async function exportAtlas(options: GuiExportOptions): Promise<GuiExportResult> {
  const validation = validateGuiExportOptions(options);

  if (!validation.valid) {
    throw new SuwolAtlasError(validation.errors.join("\n"), {
      code: "GUI_VALIDATION_FAILED"
    });
  }

  const result = await makeAtlas(options.inputDir, options.outputDir, toCoreMakeAtlasOptions(options));
  await fs.appendFile(result.files.log, `Profile: ${options.profile}\n`, "utf8");
  const json = await readJson(result.files.json);

  return {
    spriteCount: result.spriteCount,
    pngPaths: result.files.pngs,
    jsonPath: result.files.json,
    logPath: result.files.log,
    metadataPath: result.files.metadata,
    outputDir: options.outputDir,
    previewPages: buildPreviewPages(options.outputDir, json),
    warnings: result.warnings,
    metadata: {
      excludedSprites: result.metadata.excludedSprites,
      renamedSprites: result.metadata.renamedSprites,
      pivotOverrideSprites: result.metadata.pivotOverrideSprites,
      taggedSprites: result.metadata.taggedSprites,
      groupedSprites: result.metadata.groupedSprites,
      orderedSprites: result.metadata.orderedSprites,
      trimModeOverrideSprites: result.metadata.trimModeOverrideSprites,
      manualCropSprites: result.metadata.manualCropSprites
    }
  };
}

async function scanInput(options: GuiExportOptions): Promise<GuiInputSpriteScanItem[]> {
  if (!options.inputDir.trim()) {
    return [];
  }

  const resolvedInputDir = path.resolve(options.inputDir);
  const images = await loadPngImages(resolvedInputDir);

  return images.map((image) => {
    const relativePath = normalizeMetadataPathKey(path.relative(resolvedInputDir, image.filePath));
    const entry = options.spriteMetadata[relativePath];
    const { metadata, validationMessage } = resolveMetadataForScan(entry, relativePath, image.width, image.height);
    const originalName = withoutExtension(image.filePath);
    const exportName = metadata.nameOverride ?? originalName;
    const hasMetadata = entry !== undefined;
    const autoTrimRect = findAutoTrimCrop(image.png);
    const cropValidation = metadata.trimMode === "manual"
      ? validateSpriteCropRect(metadata.crop, image.width, image.height)
      : { valid: true, errors: [] };
    const status = validationMessage || !cropValidation.valid
      ? "invalid"
      : metadata.trimMode === "manual"
        ? "manual-crop"
        : !metadata.include
      ? "excluded"
      : metadata.nameOverride && metadata.nameOverride !== originalName
        ? "renamed"
        : hasMetadata
          ? "metadata"
          : "included";

    return {
      relativePath,
      originalName,
      width: image.width,
      height: image.height,
      sourceW: image.width,
      sourceH: image.height,
      autoTrimRect,
      hasMetadata,
      include: metadata.include,
      exportName,
      nameOverride: metadata.nameOverride,
      pivotX: metadata.pivotX,
      pivotY: metadata.pivotY,
      tags: metadata.tags,
      group: metadata.group,
      order: metadata.order,
      trimMode: metadata.trimMode,
      crop: metadata.crop,
      cropValid: cropValidation.valid && !validationMessage,
      validationMessage: validationMessage ?? cropValidation.errors.join(" "),
      status
    };
  });
}

async function getSourceImagePreview(request: GuiSourcePreviewRequest): Promise<GuiSourceImagePreview> {
  const filePath = resolveInputRelativePath(request.inputDir, request.relativePath);
  const png = PNG.sync.read(await fs.readFile(filePath));

  return {
    relativePath: normalizeMetadataPathKey(request.relativePath),
    width: png.width,
    height: png.height,
    url: pathToFileURL(filePath).href
  };
}

async function computeAutoTrimRect(request: GuiSourcePreviewRequest) {
  const filePath = resolveInputRelativePath(request.inputDir, request.relativePath);
  const png = PNG.sync.read(await fs.readFile(filePath));
  return findAutoTrimCrop(png);
}

function resolveMetadataForScan(
  entry: SpriteMetadataEntry | undefined,
  relativePath: string,
  width: number,
  height: number
): { metadata: NormalizedSpriteMetadata; validationMessage?: string } {
  try {
    return {
      metadata: validateAndResolveSpriteMetadata(entry, relativePath, width, height)
    };
  } catch (error) {
    const normalized = normalizeSpriteMetadataEntry(entry);
    const trimMode = normalizeTrimModeForScan(normalized.trimMode);
    const metadata: NormalizedSpriteMetadata = {
      include: typeof normalized.include === "boolean" ? normalized.include : true,
      nameOverride: typeof normalized.nameOverride === "string" && normalized.nameOverride.trim()
        ? normalized.nameOverride.trim()
        : undefined,
      pivotX: typeof normalized.pivotX === "number" && Number.isFinite(normalized.pivotX)
        ? Math.min(1, Math.max(0, normalized.pivotX))
        : 0.5,
      pivotY: typeof normalized.pivotY === "number" && Number.isFinite(normalized.pivotY)
        ? Math.min(1, Math.max(0, normalized.pivotY))
        : 0.5,
      tags: Array.isArray(normalized.tags) ? normalized.tags.filter((tag): tag is string => typeof tag === "string") : [],
      group: typeof normalized.group === "string" ? normalized.group : "",
      order: typeof normalized.order === "number" && Number.isFinite(normalized.order) ? normalized.order : undefined,
      trimMode,
      crop: normalized.crop
    };

    return {
      metadata,
      validationMessage: describeError(error)
    };
  }
}

function normalizeTrimModeForScan(value: unknown): SpriteTrimMode {
  return value === "auto" || value === "none" || value === "manual" || value === "default"
    ? value
    : "default";
}

async function runBatchExport(paths: string[], options: GuiBatchExportOptions = {}): Promise<GuiBatchExportResult> {
  const result = await batchExport(paths, {
    cacheOverride: options.cacheOverride,
    failFast: options.failFast
  });

  return {
    total: result.total,
    succeeded: result.succeeded,
    failed: result.failed,
    results: result.results.map((item) => ({
      projectPath: item.projectPath,
      success: item.success,
      spriteCount: item.result?.spriteCount,
      pageCount: item.result?.files.pngs.length,
      outputDir: item.result ? path.dirname(item.result.files.json) : undefined,
      jsonPath: item.result?.files.json,
      logPath: item.result?.files.log,
      metadataPath: item.result?.files.metadata,
      excludedSprites: item.result?.metadata.excludedSprites,
      renamedSprites: item.result?.metadata.renamedSprites,
      manualCropSprites: item.result?.metadata.manualCropSprites,
      error: item.error
    }))
  };
}

async function startGuiWatch(options: GuiExportOptions): Promise<void> {
  const validation = validateGuiExportOptions(options);

  if (!validation.valid) {
    throw new SuwolAtlasError(validation.errors.join("\n"), {
      code: "GUI_VALIDATION_FAILED"
    });
  }

  stopGuiWatch();

  guiWatcher = watchAtlas({
    inputDir: options.inputDir,
    outputDir: options.outputDir,
    debounceMs: 750,
    run: (reason) => exportAtlas(options).then((result) => ({ result, reason })),
    onFileEvent: (reason) => sendWatchEvent({
      kind: "file-event",
      message: reason,
      reason,
      at: new Date().toISOString()
    }),
    onQueued: (reason) => sendWatchEvent({
      kind: "queued",
      message: "Export queued after current export.",
      reason,
      at: new Date().toISOString()
    }),
    onStart: (reason) => sendWatchEvent({
      kind: "running",
      message: `Auto export running: ${reason}`,
      reason,
      at: new Date().toISOString()
    }),
    onSuccess: ({ result, reason }) => sendWatchEvent({
      kind: "success",
      message: `Auto exported ${result.spriteCount} sprite(s).`,
      reason,
      result,
      at: new Date().toISOString()
    }),
    onError: (error, reason) => sendWatchEvent({
      kind: "error",
      message: describeError(error),
      reason,
      error: describeError(error),
      at: new Date().toISOString()
    })
  });

  sendWatchEvent({
    kind: "started",
    message: "Watch started.",
    at: new Date().toISOString()
  });
}

function stopGuiWatch(): void {
  if (!guiWatcher) {
    return;
  }

  guiWatcher.close();
  guiWatcher = null;
  sendWatchEvent({
    kind: "stopped",
    message: "Watch stopped.",
    at: new Date().toISOString()
  });
}

function sendWatchEvent(event: GuiWatchEvent): void {
  mainWindow?.webContents.send("watch:event", event);
}

async function openProjectDialog(): Promise<GuiProjectLoadResult | null> {
  const options: OpenDialogOptions = {
    title: "Open Suwol Atlas Maker project",
    properties: ["openFile"],
    filters: [
      { name: "Suwol Atlas Maker Project", extensions: ["suwol-atlas.json"] },
      { name: "JSON", extensions: ["json"] }
    ]
  };
  const result = mainWindow
    ? await dialog.showOpenDialog(mainWindow, options)
    : await dialog.showOpenDialog(options);

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return loadProjectFromPath(result.filePaths[0]);
}

async function saveProject(request: GuiProjectSaveRequest): Promise<GuiProjectSaveResult> {
  if (!request.path) {
    throw new Error("Project path is required. Use Save Project As first.");
  }

  const filePath = ensureProjectExtension(request.path);
  await writeProjectFile(filePath, request.project);
  await rememberRecentProject(filePath);

  return {
    path: filePath,
    project: normalizeProjectFile(request.project).project
  };
}

async function saveProjectAs(request: GuiProjectSaveRequest): Promise<GuiProjectSaveResult | null> {
  const options: SaveDialogOptions = {
    title: "Save Suwol Atlas Maker project",
    defaultPath: request.path ?? `${request.project.name}${PROJECT_FILE_EXTENSION}`,
    filters: [
      { name: "Suwol Atlas Maker Project", extensions: ["suwol-atlas.json"] },
      { name: "JSON", extensions: ["json"] }
    ]
  };
  const result = mainWindow
    ? await dialog.showSaveDialog(mainWindow, options)
    : await dialog.showSaveDialog(options);

  if (result.canceled || !result.filePath) {
    return null;
  }

  return saveProject({
    path: result.filePath,
    project: request.project
  });
}

async function loadProjectFromPath(filePath: string): Promise<GuiProjectLoadResult> {
  if (!filePath || typeof filePath !== "string") {
    throw new Error("Project path is required.");
  }

  try {
    const text = await fs.readFile(filePath, "utf8");
    const { project, warnings } = normalizeProjectFile(JSON.parse(text));
    await rememberRecentProject(filePath);

    return {
      path: filePath,
      project,
      warnings
    };
  } catch (error) {
    throw new Error(`Failed to load project file "${filePath}": ${describeError(error)}`);
  }
}

async function openRecentProject(filePath: string): Promise<GuiProjectLoadResult> {
  try {
    return await loadProjectFromPath(filePath);
  } catch (error) {
    await forgetRecentProject(filePath);
    throw error;
  }
}

async function listRecentProjects(): Promise<string[]> {
  const settings = await loadSettings();
  const existing: string[] = [];

  for (const filePath of settings.recentProjectPaths) {
    try {
      await fs.access(filePath);
      existing.push(filePath);
    } catch {
      // Missing recent projects are pruned silently; opening them still reports an error.
    }
  }

  if (existing.length !== settings.recentProjectPaths.length) {
    await saveSettings({
      ...settings,
      recentProjectPaths: existing
    });
  }

  return existing;
}

async function writeProjectFile(filePath: string, project: GuiProjectFile): Promise<void> {
  const normalized = normalizeProjectFile(project).project;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
}

async function rememberRecentProject(filePath: string): Promise<void> {
  const settings = await loadSettings();
  await saveSettings({
    ...settings,
    lastProjectPath: filePath,
    recentProjectPaths: addRecentProjectPath(settings.recentProjectPaths, filePath)
  });
}

async function forgetRecentProject(filePath: string): Promise<void> {
  const settings = await loadSettings();
  await saveSettings({
    ...settings,
    lastProjectPath: settings.lastProjectPath === filePath ? null : settings.lastProjectPath,
    recentProjectPaths: removeRecentProjectPath(settings.recentProjectPaths, filePath)
  });
}

function ensureProjectExtension(filePath: string): string {
  return filePath.toLowerCase().endsWith(PROJECT_FILE_EXTENSION)
    ? filePath
    : `${filePath}${PROJECT_FILE_EXTENSION}`;
}

async function readJson(filePath: string): Promise<GuiAtlasJson> {
  const text = await readTextFile(filePath);
  return JSON.parse(text) as GuiAtlasJson;
}

async function readTextFile(filePath: string): Promise<string> {
  if (!filePath || typeof filePath !== "string") {
    throw new Error("File path is required.");
  }

  return fs.readFile(filePath, "utf8");
}

async function openOutputDirectory(directoryPath: string): Promise<void> {
  if (!directoryPath || typeof directoryPath !== "string") {
    throw new Error("Output directory path is required.");
  }

  const stat = await fs.stat(directoryPath);

  if (!stat.isDirectory()) {
    throw new Error(`Output path is not a directory: ${directoryPath}`);
  }

  const errorMessage = await shell.openPath(directoryPath);

  if (errorMessage) {
    throw new Error(errorMessage);
  }
}

function buildPreviewPages(outputDir: string, json: GuiAtlasJson): GuiAtlasPagePreview[] {
  return json.pages.map((page) => {
    const filePath = path.join(outputDir, page.image);
    return {
      image: page.image,
      width: page.width,
      height: page.height,
      filePath,
      url: pathToFileURL(filePath).href
    };
  });
}

async function loadSettings(): Promise<GuiSettings> {
  try {
    const text = await fs.readFile(getSettingsPath(), "utf8");
    return normalizeGuiSettings(JSON.parse(text));
  } catch {
    return { ...DEFAULT_GUI_SETTINGS };
  }
}

async function saveSettings(settings: GuiSettings): Promise<void> {
  const normalized = normalizeGuiSettings(settings);
  await fs.mkdir(path.dirname(getSettingsPath()), { recursive: true });
  await fs.writeFile(getSettingsPath(), `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
}

async function saveWindowSize(window: BrowserWindow | null): Promise<void> {
  if (!window) {
    return;
  }

  const [windowWidth, windowHeight] = window.getSize();
  const settings = await loadSettings();
  await saveSettings({
    ...settings,
    windowWidth,
    windowHeight
  });
}

function getSettingsPath(): string {
  return path.join(app.getPath("userData"), settingsFileName);
}

function getWindowIconPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, "build", "icon.png")
    : path.resolve(currentDir, "../../build/icon.png");
}
