import { Eraser, ExternalLink, FilePlus, Files, FolderOpen, Play, Radio, Redo2, RotateCcw, Save, Undo2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  GuiAtlasJson,
  GuiAtlasJsonSprite,
  GuiBatchExportResult,
  GuiExportOptions,
  GuiExportResult,
  GuiInputSpriteScanItem,
  GuiProfileId,
  GuiProjectFile,
  GuiProjectLoadResult,
  GuiProjectSaveResult,
  GuiSettings,
  GuiSourceImagePreview,
  GuiWatchEvent,
  SpriteCropRect,
  SpriteMetadataEntry,
  SpriteTrimMode
} from "../shared/gui-types";
import {
  DEFAULT_GUI_SETTINGS,
  addTagsForSprites,
  assignSequentialOrderForSprites,
  clampPivotValue,
  clearNameOverrides,
  clearTagsAndGroups,
  createMissingMetadataScanItems,
  excludeSprites,
  filterAndSortInputSprites,
  filterSprites,
  getSpriteMetadataEntry,
  removeMissingSpriteMetadata,
  removeTagsForSprites,
  includeAllSprites,
  reorderInputSpriteOrder,
  normalizeGuiSettings,
  resetCropForSprites,
  resetPivotForSprites,
  resetSpriteMetadataEntries,
  resetSpriteOrder,
  setGroupForSprites,
  setIncludeForSprites,
  setSpriteMetadataEntry,
  setTrimModeForSprites,
  validateSpriteCropRect,
  validateGuiExportOptions
} from "../shared/gui-utils";
import type { InputSpriteIncludeFilter, InputSpriteSortKey } from "../shared/gui-utils";
import {
  centerCropRect,
  clampCropRect,
  type CropResizeHandle,
  calculatePivotFromCropPoint,
  calculatePivotPointInCrop,
  getEffectiveCropRect,
  moveCropRect,
  resizeCropRect,
  sourcePointFromPreviewPoint
} from "../shared/crop-editing";
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
} from "../shared/history";
import type { PackingAlgorithm } from "../shared/packing";
import type { SizeMode } from "../shared/sizeMode";
import {
  applyProfilePreset,
  createProjectFile,
  getProfilePreset,
  PROFILE_PRESETS,
  projectToSettings
} from "../shared/project";
import { PreviewPanel, type PreviewMode } from "./components/PreviewPanel";
import { SpriteMetadataTable } from "./components/SpriteMetadataTable";
import { SpriteTable } from "./components/SpriteTable";

type StatusKind = "idle" | "running" | "success" | "error";

function serializeEditorSettings(settings: GuiSettings): string {
  return JSON.stringify(createProjectFile(settings));
}

export function App() {
  const [history, setHistory] = useState(() =>
    createEditorHistory(normalizeGuiSettings(DEFAULT_GUI_SETTINGS), {
      serialize: serializeEditorSettings
    })
  );
  const options = history.present;
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [status, setStatus] = useState<StatusKind>("idle");
  const [statusText, setStatusText] = useState("Ready");
  const [result, setResult] = useState<GuiExportResult | null>(null);
  const [atlasJson, setAtlasJson] = useState<GuiAtlasJson | null>(null);
  const [logText, setLogText] = useState("");
  const [selectedPageIndex, setSelectedPageIndex] = useState(0);
  const [selectedSpriteName, setSelectedSpriteName] = useState<string | null>(null);
  const [spriteQuery, setSpriteQuery] = useState("");
  const [currentProjectPath, setCurrentProjectPath] = useState<string | null>(null);
  const [savedProject, setSavedProject] = useState<GuiProjectFile | null>(createProjectFile(DEFAULT_GUI_SETTINGS));
  const [recentProjects, setRecentProjects] = useState<string[]>([]);
  const [appVersion, setAppVersion] = useState("0.1.0");
  const [lastExportAt, setLastExportAt] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("fit");
  const [watchText, setWatchText] = useState("Off");
  const [lastWatchAt, setLastWatchAt] = useState<string | null>(null);
  const [batchResult, setBatchResult] = useState<GuiBatchExportResult | null>(null);
  const [inputSprites, setInputSprites] = useState<GuiInputSpriteScanItem[]>([]);
  const [selectedInputPath, setSelectedInputPath] = useState<string | null>(null);
  const [scanText, setScanText] = useState("No input scan yet.");
  const [inputIncludeFilter, setInputIncludeFilter] = useState<InputSpriteIncludeFilter>("all");
  const [inputGroupFilter, setInputGroupFilter] = useState("");
  const [inputTagFilter, setInputTagFilter] = useState("");
  const [inputTrimFilter, setInputTrimFilter] = useState<"all" | SpriteTrimMode>("all");
  const [inputSortBy, setInputSortBy] = useState<InputSpriteSortKey>("order");
  const [onlyNameOverrides, setOnlyNameOverrides] = useState(false);
  const [onlyWithCrop, setOnlyWithCrop] = useState(false);
  const [invalidOnly, setInvalidOnly] = useState(false);
  const [missingOnly, setMissingOnly] = useState(false);
  const [bulkGroup, setBulkGroup] = useState("");
  const [bulkTags, setBulkTags] = useState("");
  const [bulkTrimMode, setBulkTrimMode] = useState<SpriteTrimMode>("default");
  const [selectedInputPaths, setSelectedInputPaths] = useState<string[]>([]);
  const [lastSelectedInputPath, setLastSelectedInputPath] = useState<string | null>(null);
  const [sourcePreview, setSourcePreview] = useState<GuiSourceImagePreview | null>(null);
  const [sourcePreviewError, setSourcePreviewError] = useState("");

  const validation = useMemo(() => validateGuiExportOptions(options), [options]);
  const dirty = useMemo(() => isEditorHistoryDirty(history, serializeEditorSettings), [history]);
  const canUndo = canUndoEditorHistory(history) && status !== "running";
  const canRedo = canRedoEditorHistory(history) && status !== "running";
  const selectedProfile = useMemo(() => getProfilePreset(options.profile), [options.profile]);
  const filteredSprites = useMemo(
    () => filterSprites(atlasJson?.sprites ?? [], spriteQuery),
    [atlasJson, spriteQuery]
  );
  const missingMetadataSprites = useMemo(
    () => createMissingMetadataScanItems(options.spriteMetadata, inputSprites),
    [inputSprites, options.spriteMetadata]
  );
  const editorInputSprites = useMemo(
    () => [...inputSprites, ...missingMetadataSprites],
    [inputSprites, missingMetadataSprites]
  );
  const missingMetadataCount = missingMetadataSprites.length;
  const filteredInputSprites = useMemo(() => {
    return filterAndSortInputSprites(editorInputSprites, {
      query: spriteQuery,
      include: inputIncludeFilter,
      group: inputGroupFilter,
      tag: inputTagFilter,
      trimMode: inputTrimFilter,
      hasNameOverride: onlyNameOverrides,
      hasCrop: onlyWithCrop,
      invalidOnly,
      missingOnly,
      sortBy: inputSortBy
    });
  }, [editorInputSprites, inputGroupFilter, inputIncludeFilter, inputSortBy, inputTagFilter, inputTrimFilter, invalidOnly, missingOnly, onlyNameOverrides, onlyWithCrop, spriteQuery]);
  const groupOptions = useMemo(
    () => Array.from(new Set(editorInputSprites.map((sprite) => sprite.group).filter(Boolean))).sort(),
    [editorInputSprites]
  );
  const tagOptions = useMemo(
    () => Array.from(new Set(editorInputSprites.flatMap((sprite) => sprite.tags))).sort(),
    [editorInputSprites]
  );
  const selectedSprite = useMemo(
    () => atlasJson?.sprites.find((sprite) => sprite.name === selectedSpriteName) ?? null,
    [atlasJson, selectedSpriteName]
  );
  const selectedInputSprite = useMemo(
    () => editorInputSprites.find((sprite) => sprite.relativePath === selectedInputPath) ?? null,
    [editorInputSprites, selectedInputPath]
  );
  const selectedEditablePaths = useMemo(
    () => selectedInputPaths.length > 0
      ? selectedInputPaths
      : selectedInputPath
        ? [selectedInputPath]
        : [],
    [selectedInputPath, selectedInputPaths]
  );
  const selectedPreviewInputSprite = useMemo(
    () => selectedInputSprite ?? inputSprites.find((sprite) => sprite.exportName === selectedSprite?.name) ?? null,
    [inputSprites, selectedInputSprite, selectedSprite]
  );
  const previewSprite = useMemo(
    () => selectedSprite && selectedPreviewInputSprite
      ? {
        ...selectedSprite,
        pivotX: selectedPreviewInputSprite.pivotX,
        pivotY: selectedPreviewInputSprite.pivotY
      }
      : selectedSprite,
    [selectedPreviewInputSprite, selectedSprite]
  );
  const pageCount = result?.previewPages.length ?? 0;

  useEffect(() => {
    void loadInitialState();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if (key === "y" || (key === "z" && event.shiftKey)) {
        event.preventDefault();
        redo();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [status]);

  useEffect(() => {
    if (!settingsLoaded) {
      return;
    }

    const id = window.setTimeout(() => {
      void window.suwolAtlas.saveSettings({
        ...options,
        lastProjectPath: currentProjectPath,
        recentProjectPaths: recentProjects
      });
    }, 350);

    return () => window.clearTimeout(id);
  }, [currentProjectPath, options, recentProjects, settingsLoaded]);

  useEffect(() => {
    if (!settingsLoaded) {
      return;
    }

    if (!options.inputDir.trim()) {
      setInputSprites([]);
      setSelectedInputPath(null);
      setScanText("No input folder selected.");
      return;
    }

    const id = window.setTimeout(() => {
      void scanInputSprites();
    }, 450);

    return () => window.clearTimeout(id);
  }, [options.inputDir, options.spriteMetadata, settingsLoaded]);

  useEffect(() => window.suwolAtlas.onMenuCommand((command) => {
    if (command === "project:new") {
      void newProject();
    } else if (command === "project:open") {
      void openProject();
    } else if (command === "project:save") {
      void saveProject(false);
    } else if (command === "project:saveAs") {
      void saveProject(true);
    } else if (command === "output:open") {
      void openOutput();
    } else if (command === "batch:export") {
      void runBatchExport();
    } else if (command === "edit:undo") {
      undo();
    } else if (command === "edit:redo") {
      redo();
    }
  }), [currentProjectPath, options]);

  useEffect(() => {
    if (!selectedInputSprite || selectedInputSprite.status === "missing" || !options.inputDir.trim()) {
      setSourcePreview(null);
      setSourcePreviewError(selectedInputSprite?.status === "missing" ? "Source PNG is missing from the input folder." : "");
      return;
    }

    let cancelled = false;
    setSourcePreview(null);
    setSourcePreviewError("");

    void window.suwolAtlas.getSourceImagePreview({
      inputDir: options.inputDir,
      relativePath: selectedInputSprite.relativePath
    }).then((preview) => {
      if (!cancelled) {
        setSourcePreview(preview);
      }
    }).catch((error) => {
      if (!cancelled) {
        setSourcePreview(null);
        setSourcePreviewError(formatError(error));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [options.inputDir, selectedInputSprite?.relativePath, selectedInputSprite?.status]);

  useEffect(() => window.suwolAtlas.onWatchEvent((event) => {
    void handleWatchEvent(event);
  }), []);

  useEffect(() => {
    if (!settingsLoaded) {
      return;
    }

    if (!options.watch) {
      setWatchText("Off");
      void window.suwolAtlas.stopWatch();
      return;
    }

    if (!validation.valid) {
      setWatchText("Waiting for valid options");
      void window.suwolAtlas.stopWatch();
      return;
    }

    setWatchText("Starting...");
    void window.suwolAtlas.startWatch(buildExportOptions()).catch((error) => {
      setWatchText(formatError(error));
      setStatus("error");
      setStatusText(formatError(error));
    });

    return () => {
      void window.suwolAtlas.stopWatch();
    };
  }, [options, settingsLoaded, validation.valid]);

  async function loadInitialState() {
    const [settings, version] = await Promise.all([
      window.suwolAtlas.loadSettings(),
      window.suwolAtlas.getVersion()
    ]);
    const normalized = normalizeGuiSettings(settings);

    setHistory((current) => resetEditorHistory(current, normalized, { serialize: serializeEditorSettings }));
    setCurrentProjectPath(normalized.lastProjectPath);
    setSavedProject(createProjectFile(normalized));
    setRecentProjects(await window.suwolAtlas.listRecentProjects());
    setAppVersion(version);
    setSettingsLoaded(true);
  }

  async function chooseInput() {
    const directory = await window.suwolAtlas.selectInputDirectory();

    if (directory) {
      updateOptions({ inputDir: directory });
    }
  }

  async function chooseOutput() {
    const directory = await window.suwolAtlas.selectOutputDirectory();

    if (directory) {
      updateOptions({ outputDir: directory });
    }
  }

  async function scanInputSprites() {
    try {
      const sprites = await window.suwolAtlas.scanInput(buildExportOptions());
      setInputSprites(sprites);
      setScanText(`${sprites.length} PNG sprite(s) scanned.`);

      if (!selectedInputPath || !sprites.some((sprite) => sprite.relativePath === selectedInputPath)) {
        const nextPath = sprites[0]?.relativePath ?? null;
        setSelectedInputPath(nextPath);
        setSelectedInputPaths(nextPath ? [nextPath] : []);
      }
    } catch (error) {
      setInputSprites([]);
      setScanText(formatError(error));
    }
  }

  async function newProject() {
    const project = await window.suwolAtlas.newProject();
    applyProject(null, project, []);
    setStatus("idle");
    setStatusText("New project ready.");
  }

  async function openProject() {
    try {
      const project = await window.suwolAtlas.openProjectDialog();

      if (project) {
        await handleProjectLoaded(project);
      }
    } catch (error) {
      showError(error);
    }
  }

  async function openRecentProject(projectPath: string) {
    try {
      const project = await window.suwolAtlas.openRecentProject(projectPath);
      await handleProjectLoaded(project);
    } catch (error) {
      showError(error);
      setRecentProjects(await window.suwolAtlas.listRecentProjects());
    }
  }

  async function saveProject(forceSaveAs: boolean) {
    try {
      const request = {
        path: currentProjectPath,
        project: createProjectFile(options)
      };
      const saved = forceSaveAs || !currentProjectPath
        ? await window.suwolAtlas.saveProjectAs(request)
        : await window.suwolAtlas.saveProject(request);

      if (saved) {
        await handleProjectSaved(saved);
      }
    } catch (error) {
      showError(error);
    }
  }

  async function runExport() {
    const currentValidation = validateGuiExportOptions(options);

    if (!currentValidation.valid) {
      setStatus("error");
      setStatusText(currentValidation.errors.join(" "));
      return;
    }

    setStatus("running");
    setStatusText("Exporting atlas...");

    try {
      const exportOptions: GuiExportOptions = {
        ...buildExportOptions()
      };
      const nextResult = await window.suwolAtlas.exportAtlas(exportOptions);
      await applyExportResult(nextResult, "Exported");
    } catch (error) {
      showError(error);
    }
  }

  async function runBatchExport() {
    try {
      const paths = await window.suwolAtlas.selectBatchTargets();

      if (!paths || paths.length === 0) {
        return;
      }

      setStatus("running");
      setStatusText("Running batch export...");
      const nextBatch = await window.suwolAtlas.runBatchExport(paths);
      setBatchResult(nextBatch);
      setStatus(nextBatch.failed > 0 ? "error" : "success");
      setStatusText(`Batch exported ${nextBatch.succeeded}/${nextBatch.total} project(s).`);
    } catch (error) {
      showError(error);
    }
  }

  async function handleWatchEvent(event: GuiWatchEvent) {
    setWatchText(event.message);
    setLastWatchAt(new Date(event.at).toLocaleTimeString());

    if (event.kind === "running") {
      setStatus("running");
      setStatusText(event.message);
    } else if (event.kind === "success" && event.result) {
      await applyExportResult(event.result, "Auto exported");
      setWatchText(event.message);
    } else if (event.kind === "error") {
      setStatus("error");
      setStatusText(event.error ?? event.message);
    }
  }

  async function applyExportResult(nextResult: GuiExportResult, verb: string) {
    const [jsonRead, logRead] = await Promise.allSettled([
      window.suwolAtlas.readJson(nextResult.jsonPath),
      window.suwolAtlas.readLog(nextResult.logPath)
    ]);
    const warnings = [...nextResult.warnings];
    const nextJson = jsonRead.status === "fulfilled" ? jsonRead.value : null;
    const nextLog = logRead.status === "fulfilled" ? logRead.value : "";

    if (jsonRead.status === "rejected") {
      warnings.push(`JSON read warning: ${formatError(jsonRead.reason)}`);
    }

    if (logRead.status === "rejected") {
      warnings.push(`Log read warning: ${formatError(logRead.reason)}`);
    }

    setResult(nextResult);
    setAtlasJson(nextJson);
    setLogText([nextLog, ...warnings.map((warning) => `Warning: ${warning}`)].filter(Boolean).join("\n"));
    setSelectedPageIndex(0);
    setSelectedSpriteName(nextJson?.sprites[0]?.name ?? null);
    setStatus("success");
    setLastExportAt(new Date().toLocaleTimeString());
    setStatusText(`${verb} ${nextResult.spriteCount} sprite(s) on ${nextResult.previewPages.length} page(s).`);
  }

  function buildExportOptions(): GuiExportOptions {
    return {
      inputDir: options.inputDir,
      outputDir: options.outputDir,
      name: options.name,
      maxSize: options.maxSize,
      padding: options.padding,
      trim: options.trim,
      extrude: options.extrude,
      rotate: options.rotate,
      clean: options.clean,
      algorithm: options.algorithm,
      sizeMode: options.sizeMode,
      cache: options.cache,
      watch: options.watch,
      profile: options.profile,
      spriteMetadata: options.spriteMetadata
    };
  }

  async function openOutput() {
    if (!options.outputDir.trim()) {
      return;
    }

    try {
      await window.suwolAtlas.openOutputDirectory(options.outputDir);
    } catch (error) {
      showError(error);
    }
  }

  function updateOptions(patch: Partial<GuiSettings>) {
    commitOptions((current) => normalizeGuiSettings({ ...current, ...patch }));
  }

  function commitOptions(updater: Partial<GuiSettings> | ((current: GuiSettings) => GuiSettings)) {
    if (status === "running") {
      return;
    }

    setHistory((current) => {
      const next = typeof updater === "function"
        ? normalizeGuiSettings(updater(current.present))
        : normalizeGuiSettings({ ...current.present, ...updater });
      return pushEditorHistory(current, next, serializeEditorSettings);
    });
  }

  function undo() {
    if (status === "running") {
      return;
    }

    setHistory((current) => undoEditorHistory(current));
    setStatus("idle");
    setStatusText("Undo.");
  }

  function redo() {
    if (status === "running") {
      return;
    }

    setHistory((current) => redoEditorHistory(current));
    setStatus("idle");
    setStatusText("Redo.");
  }

  function applyPreset() {
    commitOptions((current) => applyProfilePreset(current, current.profile));
  }

  function updateProfile(profile: GuiProfileId) {
    updateOptions({ profile });
  }

  function updateZoom(nextZoom: number) {
    setPreviewMode("custom");
    updateOptions({ previewZoom: Math.min(8, Math.max(0.25, nextZoom)) });
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files[0] as (File & { path?: string }) | undefined;

    if (file?.path) {
      updateOptions({ inputDir: file.path });
    }
  }

  function handleSpriteSelect(sprite: GuiAtlasJsonSprite) {
    setSelectedSpriteName(sprite.name);

    if (sprite.page !== selectedPageIndex) {
      setSelectedPageIndex(sprite.page);
    }
  }

  function handleInputSpriteSelect(sprite: GuiInputSpriteScanItem, event?: React.MouseEvent) {
    const mode = event?.shiftKey
      ? "range"
      : event?.ctrlKey || event?.metaKey
        ? "toggle"
        : "single";

    setSelectedInputPath(sprite.relativePath);
    setSelectedInputPaths((current) => {
      if (mode === "range" && lastSelectedInputPath) {
        const visible = filteredInputSprites.map((item) => item.relativePath);
        const start = visible.indexOf(lastSelectedInputPath);
        const end = visible.indexOf(sprite.relativePath);

        if (start >= 0 && end >= 0) {
          const [from, to] = start <= end ? [start, end] : [end, start];
          return Array.from(new Set([...current, ...visible.slice(from, to + 1)]));
        }
      }

      if (mode === "toggle") {
        return current.includes(sprite.relativePath)
          ? current.filter((item) => item !== sprite.relativePath)
          : [...current, sprite.relativePath];
      }

      return [sprite.relativePath];
    });
    setLastSelectedInputPath(sprite.relativePath);

    const exported = atlasJson?.sprites.find((item) => item.name === sprite.exportName);

    if (exported) {
      handleSpriteSelect(exported);
    }
  }

  function updateInputSpriteMetadata(sprite: GuiInputSpriteScanItem, patch: SpriteMetadataEntry) {
    const current = getSpriteMetadataEntry(options.spriteMetadata, sprite.relativePath);
    const nextPatch = { ...patch };

    if (nextPatch.trimMode === "manual" && nextPatch.crop === undefined) {
      nextPatch.crop = current.crop ?? sprite.crop ?? sprite.autoTrimRect ?? fullImageCrop(sprite);
    } else if (nextPatch.trimMode && nextPatch.trimMode !== "manual") {
      nextPatch.crop = undefined;
    }

    updateOptions({
      spriteMetadata: setSpriteMetadataEntry(options.spriteMetadata, sprite.relativePath, {
        ...current,
        ...nextPatch
      })
    });
  }

  function updateSelectedSpriteMetadata(patch: SpriteMetadataEntry) {
    if (!selectedInputSprite) {
      return;
    }

    updateInputSpriteMetadata(selectedInputSprite, patch);
  }

  function updatePreviewPivot(pivot: { pivotX: number; pivotY: number }) {
    if (!selectedPreviewInputSprite) {
      return;
    }

    updateInputSpriteMetadata(selectedPreviewInputSprite, {
      pivotX: clampPivotValue(pivot.pivotX),
      pivotY: clampPivotValue(pivot.pivotY)
    });
  }

  function setSelectedPivot(pivotX: number, pivotY: number) {
    updateSelectedSpriteMetadata({
      pivotX: clampPivotValue(pivotX),
      pivotY: clampPivotValue(pivotY)
    });
  }

  function toggleInputSpriteInclude(sprite: GuiInputSpriteScanItem) {
    const current = getSpriteMetadataEntry(options.spriteMetadata, sprite.relativePath);
    updateOptions({
      spriteMetadata: setSpriteMetadataEntry(options.spriteMetadata, sprite.relativePath, {
        ...current,
        include: !sprite.include
      })
    });
  }

  function resetSelectedMetadata() {
    if (selectedEditablePaths.length === 0) {
      return;
    }

    updateOptions({
      spriteMetadata: resetSpriteMetadataEntries(options.spriteMetadata, selectedEditablePaths)
    });
  }

  function includeAll() {
    updateOptions({ spriteMetadata: includeAllSprites(options.spriteMetadata, inputSprites) });
  }

  function includeSelected() {
    if (selectedEditablePaths.length === 0) {
      return;
    }

    updateOptions({ spriteMetadata: setIncludeForSprites(options.spriteMetadata, selectedEditablePaths, true) });
  }

  function excludeSelected() {
    if (selectedEditablePaths.length === 0) {
      return;
    }

    updateOptions({ spriteMetadata: excludeSprites(options.spriteMetadata, selectedEditablePaths) });
  }

  function clearOverrides() {
    updateOptions({ spriteMetadata: clearNameOverrides(options.spriteMetadata) });
  }

  function clearGroups() {
    updateOptions({ spriteMetadata: clearTagsAndGroups(options.spriteMetadata) });
  }

  function moveSelectedOrder(action: "up" | "down" | "top" | "bottom") {
    if (!selectedInputSprite) {
      return;
    }

    updateOptions({
      spriteMetadata: reorderInputSpriteOrder(options.spriteMetadata, inputSprites, selectedInputSprite.relativePath, action)
    });
  }

  function moveSpriteOrder(sprite: GuiInputSpriteScanItem, action: "up" | "down" | "top" | "bottom") {
    updateOptions({
      spriteMetadata: reorderInputSpriteOrder(options.spriteMetadata, inputSprites, sprite.relativePath, action)
    });
  }

  function resetOrder() {
    updateOptions({ spriteMetadata: resetSpriteOrder(options.spriteMetadata) });
  }

  function applyGroupToSelected() {
    if (selectedEditablePaths.length === 0) {
      return;
    }

    updateOptions({
      spriteMetadata: setGroupForSprites(options.spriteMetadata, selectedEditablePaths, bulkGroup)
    });
  }

  function applyTrimModeToSelected() {
    if (selectedEditablePaths.length === 0) {
      return;
    }

    if (bulkTrimMode === "manual") {
      let next = { ...options.spriteMetadata };
      for (const relativePath of selectedEditablePaths) {
        const sprite = editorInputSprites.find((item) => item.relativePath === relativePath);
        const current = getSpriteMetadataEntry(next, relativePath);
        next = setSpriteMetadataEntry(next, relativePath, {
          ...current,
          trimMode: "manual",
          crop: sprite && sprite.sourceW > 0
            ? current.crop ?? sprite.crop ?? sprite.autoTrimRect ?? fullImageCrop(sprite)
            : current.crop
        });
      }
      updateOptions({ spriteMetadata: next });
      return;
    }

    updateOptions({
      spriteMetadata: setTrimModeForSprites(options.spriteMetadata, selectedEditablePaths, bulkTrimMode)
    });
  }

  function addTagsToSelected() {
    if (selectedEditablePaths.length === 0) {
      return;
    }

    updateOptions({
      spriteMetadata: addTagsForSprites(
        options.spriteMetadata,
        selectedEditablePaths,
        bulkTags.split(",").map((tag) => tag.trim())
      )
    });
  }

  function removeTagsFromSelected() {
    if (selectedEditablePaths.length === 0) {
      return;
    }

    updateOptions({
      spriteMetadata: removeTagsForSprites(
        options.spriteMetadata,
        selectedEditablePaths,
        bulkTags.split(",").map((tag) => tag.trim())
      )
    });
  }

  function resetCropForSelected() {
    if (selectedEditablePaths.length === 0) {
      return;
    }

    updateOptions({ spriteMetadata: resetCropForSprites(options.spriteMetadata, selectedEditablePaths) });
  }

  function resetPivotForSelected() {
    if (selectedEditablePaths.length === 0) {
      return;
    }

    updateOptions({ spriteMetadata: resetPivotForSprites(options.spriteMetadata, selectedEditablePaths) });
  }

  function assignSequentialOrderToSelected() {
    const orderedSelection = filteredInputSprites
      .map((sprite) => sprite.relativePath)
      .filter((relativePath) => selectedEditablePaths.includes(relativePath));

    if (orderedSelection.length === 0) {
      return;
    }

    updateOptions({
      spriteMetadata: assignSequentialOrderForSprites(options.spriteMetadata, orderedSelection)
    });
  }

  function clearOrderForSelected() {
    if (selectedEditablePaths.length === 0) {
      return;
    }

    let next = { ...options.spriteMetadata };
    for (const relativePath of selectedEditablePaths) {
      const entry = getSpriteMetadataEntry(next, relativePath);
      const { order: _order, ...rest } = entry;
      next = setSpriteMetadataEntry(next, relativePath, rest);
    }

    updateOptions({ spriteMetadata: next });
  }

  function selectAllVisibleInputSprites() {
    const visiblePaths = filteredInputSprites.map((sprite) => sprite.relativePath);
    setSelectedInputPaths(visiblePaths);
    setSelectedInputPath(visiblePaths[0] ?? null);
    setLastSelectedInputPath(visiblePaths[0] ?? null);
  }

  function resetInputFilters() {
    setSpriteQuery("");
    setInputIncludeFilter("all");
    setInputGroupFilter("");
    setInputTagFilter("");
    setInputTrimFilter("all");
    setInputSortBy("order");
    setOnlyNameOverrides(false);
    setOnlyWithCrop(false);
    setInvalidOnly(false);
    setMissingOnly(false);
  }

  function cleanupMissingMetadata() {
    if (missingMetadataCount === 0) {
      return;
    }

    if (!window.confirm(`Remove ${missingMetadataCount} missing sprite metadata entr${missingMetadataCount === 1 ? "y" : "ies"}?`)) {
      return;
    }

    updateOptions({
      spriteMetadata: removeMissingSpriteMetadata(options.spriteMetadata, inputSprites)
    });
    setSelectedInputPaths((current) => current.filter((relativePath) =>
      !missingMetadataSprites.some((sprite) => sprite.relativePath === relativePath)
    ));
  }

  function updateSelectedTrimMode(trimMode: SpriteTrimMode) {
    if (!selectedInputSprite) {
      return;
    }

    updateSelectedSpriteMetadata({
      trimMode,
      crop: trimMode === "manual"
        ? selectedInputSprite.crop ?? selectedInputSprite.autoTrimRect ?? fullImageCrop(selectedInputSprite)
        : undefined
    });
  }

  function updateSelectedCrop(patch: Partial<SpriteCropRect>) {
    if (!selectedInputSprite) {
      return;
    }

    const base = selectedInputSprite.crop ?? selectedInputSprite.autoTrimRect ?? fullImageCrop(selectedInputSprite);
    const nextCrop = clampCropRect({
      ...base,
      ...patch
    }, selectedInputSprite.sourceW, selectedInputSprite.sourceH);
    updateSelectedSpriteMetadata({
      trimMode: "manual",
      crop: nextCrop
    });
  }

  function useFullImageCrop() {
    if (!selectedInputSprite) {
      return;
    }

    updateSelectedSpriteMetadata({
      trimMode: "none",
      crop: undefined
    });
  }

  function useCurrentAutoTrimCrop() {
    if (!selectedInputSprite) {
      return;
    }

    updateSelectedSpriteMetadata({
      trimMode: "manual",
      crop: selectedInputSprite.autoTrimRect ?? fullImageCrop(selectedInputSprite)
    });
  }

  function resetCrop() {
    updateSelectedSpriteMetadata({
      trimMode: "default",
      crop: undefined
    });
  }

  function centerSelectedCrop() {
    if (!selectedInputSprite) {
      return;
    }

    updateSelectedSpriteMetadata({
      trimMode: "manual",
      crop: centerCropRect(selectedInputSprite.sourceW, selectedInputSprite.sourceH)
    });
  }

  function applySelectedCrop() {
    if (!selectedInputSprite) {
      return;
    }

    updateSelectedSpriteMetadata({
      trimMode: "manual",
      crop: selectedInputSprite.crop ?? selectedInputSprite.autoTrimRect ?? fullImageCrop(selectedInputSprite)
    });
  }

  function commitVisualCrop(sprite: GuiInputSpriteScanItem, crop: SpriteCropRect) {
    updateInputSpriteMetadata(sprite, {
      trimMode: "manual",
      crop: clampCropRect(crop, sprite.sourceW, sprite.sourceH)
    });
  }

  function commitVisualPivot(sprite: GuiInputSpriteScanItem, pivot: { pivotX: number; pivotY: number }) {
    updateInputSpriteMetadata(sprite, {
      pivotX: clampPivotValue(pivot.pivotX),
      pivotY: clampPivotValue(pivot.pivotY)
    });
  }

  function validateSelectedCrop() {
    if (!selectedInputSprite) {
      return;
    }

    const result = validateSpriteCropRect(selectedInputSprite.crop, selectedInputSprite.sourceW, selectedInputSprite.sourceH);
    setStatus(result.valid ? "success" : "error");
    setStatusText(result.valid ? "Crop is valid." : result.errors.join(" "));
  }

  async function handleProjectLoaded(projectLoad: GuiProjectLoadResult) {
    applyProject(projectLoad.path, projectLoad.project, projectLoad.warnings);
    setRecentProjects(await window.suwolAtlas.listRecentProjects());
  }

  async function handleProjectSaved(saveResult: GuiProjectSaveResult) {
    setCurrentProjectPath(saveResult.path);
    setSavedProject(saveResult.project);
    setHistory((current) => markEditorHistorySaved(current, serializeEditorSettings));
    setRecentProjects(await window.suwolAtlas.listRecentProjects());
    setStatus("success");
    setStatusText("Project saved.");
  }

  function applyProject(projectPath: string | null, project: GuiProjectFile, warnings: string[]) {
    const nextSettings = projectToSettings(project, options);
    setHistory((current) => resetEditorHistory(current, nextSettings, { serialize: serializeEditorSettings }));
    setCurrentProjectPath(projectPath);
    setSavedProject(project);
    setResult(null);
    setAtlasJson(null);
    setInputSprites([]);
    setSelectedInputPath(null);
    setSelectedInputPaths([]);
    setLastSelectedInputPath(null);
    setSourcePreview(null);
    setSourcePreviewError("");
    setScanText("Scan input folder to edit sprite metadata.");
    setLogText(warnings.map((warning) => `Warning: ${warning}`).join("\n"));
    setSelectedPageIndex(0);
    setSelectedSpriteName(null);
    setStatus(warnings.length > 0 ? "error" : "idle");
    setStatusText(warnings.length > 0 ? warnings.join(" ") : "Project loaded.");
  }

  function showError(error: unknown) {
    setStatus("error");
    setStatusText(formatError(error));
  }

  function formatError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  return (
    <div className="appShell">
      <header className="appHeader">
        <div>
          <h1>Suwol Atlas Maker</h1>
          <span>v{appVersion}</span>
        </div>
        <div className="statusCluster">
          <button type="button" className="iconButton" title="Undo" disabled={!canUndo} onClick={undo}>
            <Undo2 size={16} />
          </button>
          <button type="button" className="iconButton" title="Redo" disabled={!canRedo} onClick={redo}>
            <Redo2 size={16} />
          </button>
          <span className="historyBadge">{history.past.length}/{history.future.length}</span>
          <span className={dirty ? "dirtyBadge dirty" : "dirtyBadge"}>{dirty ? "Unsaved" : "Saved"}</span>
          <div className={`statusPill ${status}`}>{statusText}</div>
        </div>
      </header>

      <main className="workspace">
        <section className="panel setupPanel" onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
          <div className="panelHeader">
            <h2>Project</h2>
            <button type="button" className="iconButton" title="New project" onClick={() => void newProject()}>
              <FilePlus size={17} />
            </button>
          </div>

          <div className="projectPathBox">
            <span>{currentProjectPath ?? "Unsaved project"}</span>
          </div>

          <div className="projectButtonGrid">
            <button type="button" onClick={() => void openProject()}>
              <FolderOpen size={17} />
              Open
            </button>
            <button type="button" onClick={() => void saveProject(false)}>
              <Save size={17} />
              Save
            </button>
            <button type="button" onClick={() => void saveProject(true)}>
              <Save size={17} />
              Save As
            </button>
          </div>

          {recentProjects.length > 0 && (
            <div className="recentBox">
              <div className="miniLabel">Recent Projects</div>
              {recentProjects.map((projectPath) => (
                <button
                  type="button"
                  key={projectPath}
                  title={projectPath}
                  className="recentItem"
                  onClick={() => void openRecentProject(projectPath)}
                >
                  {projectPath}
                </button>
              ))}
            </div>
          )}

          <label className="field">
            <span>Input folder</span>
            <div className="pathControl">
              <input value={options.inputDir} onChange={(event) => updateOptions({ inputDir: event.target.value })} />
              <button type="button" title="Select input folder" onClick={chooseInput}>
                <FolderOpen size={17} />
              </button>
            </div>
          </label>

          <label className="field">
            <span>Output folder</span>
            <div className="pathControl">
              <input value={options.outputDir} onChange={(event) => updateOptions({ outputDir: event.target.value })} />
              <button type="button" title="Select output folder" onClick={chooseOutput}>
                <FolderOpen size={17} />
              </button>
            </div>
          </label>

          <div className="profileBox">
            <label className="field">
              <span>Profile</span>
              <select value={options.profile} onChange={(event) => updateProfile(event.target.value as GuiProfileId)}>
                {PROFILE_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>{preset.label}</option>
                ))}
              </select>
            </label>
            <button type="button" onClick={applyPreset}>Apply Preset</button>
            <p>{selectedProfile.description}</p>
          </div>

          <div className="optionsGrid">
            <label className="field">
              <span>Atlas name</span>
              <input value={options.name} onChange={(event) => updateOptions({ name: event.target.value })} />
            </label>

            <label className="field">
              <span>Algorithm</span>
              <select value={options.algorithm} onChange={(event) => updateOptions({ algorithm: event.target.value as PackingAlgorithm })}>
                <option value="shelf">Shelf</option>
                <option value="maxrects">MaxRects</option>
              </select>
            </label>

            <label className="field">
              <span>Size Mode</span>
              <select value={options.sizeMode} onChange={(event) => updateOptions({ sizeMode: event.target.value as SizeMode })}>
                <option value="tight">Tight</option>
                <option value="pot">Power of Two</option>
                <option value="square-pot">Square Power of Two</option>
              </select>
            </label>

            <label className="field">
              <span>Max size</span>
              <select value={options.maxSize} onChange={(event) => updateOptions({ maxSize: Number(event.target.value) })}>
                <option value={1024}>1024</option>
                <option value={2048}>2048</option>
                <option value={4096}>4096</option>
                <option value={8192}>8192</option>
              </select>
            </label>

            <label className="field">
              <span>Padding</span>
              <input
                type="number"
                min={0}
                value={options.padding}
                onChange={(event) => updateOptions({ padding: Number(event.target.value) })}
              />
            </label>

            <label className="field">
              <span>Extrude</span>
              <input
                type="number"
                min={0}
                value={options.extrude}
                onChange={(event) => updateOptions({ extrude: Number(event.target.value) })}
              />
            </label>
          </div>

          <div className="toggleRow">
            <label><input type="checkbox" checked={options.trim} onChange={(event) => updateOptions({ trim: event.target.checked })} /> Trim</label>
            <label><input type="checkbox" checked={options.rotate} onChange={(event) => updateOptions({ rotate: event.target.checked })} /> Rotate</label>
            <label><input type="checkbox" checked={options.clean} onChange={(event) => updateOptions({ clean: event.target.checked })} /> Clean</label>
            <label><input type="checkbox" checked={options.cache} onChange={(event) => updateOptions({ cache: event.target.checked })} /> Cache</label>
            <label><input type="checkbox" checked={options.watch} onChange={(event) => updateOptions({ watch: event.target.checked })} /> Watch</label>
          </div>

          {!validation.valid && <div className="validationBox">{validation.errors.join(" ")}</div>}

          <div className="exportStats">
            <span>Algorithm: {options.algorithm}</span>
            <span>Size: {options.sizeMode}</span>
            <span>Cache: {options.cache ? "on" : "off"}</span>
            <span>Last export: {lastExportAt ?? "-"}</span>
            <span>Pages: {pageCount || "-"}</span>
            <span>Sprites: {result?.spriteCount ?? "-"}</span>
          </div>

          <div className="watchBox">
            <div>
              <Radio size={16} />
              <span>Watch: {options.watch ? watchText : "Off"}</span>
            </div>
            <span>{lastWatchAt ?? "-"}</span>
          </div>

          <div className="actionRow">
            <button type="button" className="primaryButton" disabled={status === "running"} onClick={() => void runExport()}>
              {status === "running" ? <RotateCcw size={18} className="spinIcon" /> : <Play size={18} />}
              Export
            </button>
            <button type="button" disabled={!options.outputDir.trim()} onClick={() => void openOutput()}>
              <ExternalLink size={17} />
              Open
            </button>
            <button type="button" onClick={() => void runBatchExport()}>
              <Files size={17} />
              Batch
            </button>
          </div>

          {batchResult && (
            <div className="batchBox">
              <div className="miniLabel">Batch Export</div>
              <strong>{batchResult.succeeded}/{batchResult.total} succeeded</strong>
              {batchResult.results.map((item) => (
                <div key={item.projectPath} className={item.success ? "batchItem ok" : "batchItem fail"} title={item.projectPath}>
                  <span>{item.success ? "OK" : "FAIL"}</span>
                  <p>{item.projectPath}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <PreviewPanel
          pages={result?.previewPages ?? []}
          selectedPageIndex={selectedPageIndex}
          selectedSprite={previewSprite}
          zoom={options.previewZoom}
          mode={previewMode}
          onSelectPage={setSelectedPageIndex}
          onZoomIn={() => updateZoom(options.previewZoom * 1.25)}
          onZoomOut={() => updateZoom(options.previewZoom / 1.25)}
          onFit={() => setPreviewMode("fit")}
          onActualSize={() => {
            setPreviewMode("actual");
            updateOptions({ previewZoom: 1 });
          }}
          onPivotChange={updatePreviewPivot}
        />

        <section className="panel spritePanel">
          <div className="panelHeader">
            <h2>Sprites</h2>
            <span>{filteredInputSprites.length || filteredSprites.length}</span>
          </div>
          <input
            className="searchInput"
            placeholder="Search"
            value={spriteQuery}
            onChange={(event) => setSpriteQuery(event.target.value)}
          />

          <div className="spriteFilterGrid">
            <label className="field">
              <span>Include</span>
              <select value={inputIncludeFilter} onChange={(event) => setInputIncludeFilter(event.target.value as InputSpriteIncludeFilter)}>
                <option value="all">All</option>
                <option value="included">Included</option>
                <option value="excluded">Excluded</option>
              </select>
            </label>
            <label className="field">
              <span>Group</span>
              <select value={inputGroupFilter} onChange={(event) => setInputGroupFilter(event.target.value)}>
                <option value="">All</option>
                {groupOptions.map((group) => <option key={group} value={group}>{group}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Tag</span>
              <select value={inputTagFilter} onChange={(event) => setInputTagFilter(event.target.value)}>
                <option value="">All</option>
                {tagOptions.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Trim</span>
              <select value={inputTrimFilter} onChange={(event) => setInputTrimFilter(event.target.value as "all" | SpriteTrimMode)}>
                <option value="all">All</option>
                <option value="default">Default</option>
                <option value="auto">Auto</option>
                <option value="none">None</option>
                <option value="manual">Manual</option>
              </select>
            </label>
            <label className="field">
              <span>Sort</span>
              <select value={inputSortBy} onChange={(event) => setInputSortBy(event.target.value as InputSpriteSortKey)}>
                <option value="order">Order</option>
                <option value="source">Source</option>
                <option value="export">Export</option>
                <option value="group">Group</option>
                <option value="include">Include</option>
                <option value="trim">Trim</option>
                <option value="invalid">Invalid</option>
              </select>
            </label>
            <label className="inlineCheck">
              <input type="checkbox" checked={onlyNameOverrides} onChange={(event) => setOnlyNameOverrides(event.target.checked)} />
              Names
            </label>
            <label className="inlineCheck">
              <input type="checkbox" checked={onlyWithCrop} onChange={(event) => setOnlyWithCrop(event.target.checked)} />
              Crop
            </label>
            <label className="inlineCheck">
              <input type="checkbox" checked={invalidOnly} onChange={(event) => setInvalidOnly(event.target.checked)} />
              Invalid
            </label>
            <label className="inlineCheck">
              <input type="checkbox" checked={missingOnly} onChange={(event) => setMissingOnly(event.target.checked)} />
              Missing
            </label>
            <button type="button" className="compactButton" onClick={resetInputFilters}>Reset Filters</button>
          </div>

          <div className="metadataEditor">
            <div className="metadataEditorHeader">
              <span>{scanText} Missing metadata: {missingMetadataCount}. Selected: {selectedEditablePaths.length}.</span>
              <div className="metadataHeaderActions">
                <button type="button" onClick={selectAllVisibleInputSprites} disabled={filteredInputSprites.length === 0}>Select Visible</button>
                <button type="button" onClick={cleanupMissingMetadata} disabled={missingMetadataCount === 0}>Cleanup Missing</button>
                <button type="button" title="Scan input sprites" onClick={() => void scanInputSprites()}>
                  <RotateCcw size={15} />
                  Scan
                </button>
              </div>
            </div>

            <div className="bulkActionRow">
              <button type="button" onClick={includeAll} disabled={inputSprites.length === 0}>Include All</button>
              <button type="button" onClick={includeSelected} disabled={selectedEditablePaths.length === 0}>Include Selected</button>
              <button type="button" onClick={excludeSelected} disabled={selectedEditablePaths.length === 0}>Exclude Selected</button>
              <button type="button" onClick={resetSelectedMetadata} disabled={selectedEditablePaths.length === 0}>
                <Eraser size={15} />
                Reset
              </button>
              <button type="button" onClick={clearOverrides}>Clear Names</button>
              <button type="button" onClick={clearGroups}>Clear Tags</button>
              <button type="button" onClick={() => moveSelectedOrder("top")} disabled={!selectedInputSprite}>Top</button>
              <button type="button" onClick={() => moveSelectedOrder("up")} disabled={!selectedInputSprite}>Up</button>
              <button type="button" onClick={() => moveSelectedOrder("down")} disabled={!selectedInputSprite}>Down</button>
              <button type="button" onClick={() => moveSelectedOrder("bottom")} disabled={!selectedInputSprite}>Bottom</button>
              <button type="button" onClick={assignSequentialOrderToSelected} disabled={selectedEditablePaths.length === 0}>Sequential Order</button>
              <button type="button" onClick={clearOrderForSelected} disabled={selectedEditablePaths.length === 0}>Clear Order</button>
              <button type="button" onClick={resetOrder}>Reset Order</button>
              <button type="button" onClick={resetCropForSelected} disabled={selectedEditablePaths.length === 0}>Reset Crop</button>
              <button type="button" onClick={resetPivotForSelected} disabled={selectedEditablePaths.length === 0}>Reset Pivot</button>
            </div>

            <div className="bulkEditRow">
              <input value={bulkGroup} placeholder="Group for selected" onChange={(event) => setBulkGroup(event.target.value)} />
              <button type="button" onClick={applyGroupToSelected} disabled={selectedEditablePaths.length === 0}>Set Group</button>
              <input value={bulkTags} placeholder="Tags, comma separated" onChange={(event) => setBulkTags(event.target.value)} />
              <button type="button" onClick={addTagsToSelected} disabled={selectedEditablePaths.length === 0}>Add Tags</button>
              <button type="button" onClick={removeTagsFromSelected} disabled={selectedEditablePaths.length === 0}>Remove Tags</button>
              <select value={bulkTrimMode} onChange={(event) => setBulkTrimMode(event.target.value as SpriteTrimMode)}>
                <option value="default">Default Trim</option>
                <option value="auto">Auto Trim</option>
                <option value="none">No Trim</option>
                <option value="manual">Manual Crop</option>
              </select>
              <button type="button" onClick={applyTrimModeToSelected} disabled={selectedEditablePaths.length === 0}>Set Trim</button>
            </div>

            {selectedInputSprite ? (
              <div className="spriteEditorGrid">
                <label className="field includeField">
                  <span>Include</span>
                  <input
                    type="checkbox"
                    checked={selectedInputSprite.include}
                    onChange={() => toggleInputSpriteInclude(selectedInputSprite)}
                  />
                </label>
                <label className="field">
                  <span>Source</span>
                  <input value={selectedInputSprite.relativePath} readOnly />
                </label>
                <label className="field">
                  <span>Order</span>
                  <input
                    type="number"
                    min={0}
                    value={selectedInputSprite.order ?? ""}
                    onChange={(event) => updateSelectedSpriteMetadata({
                      order: event.target.value === "" ? undefined : Number(event.target.value)
                    })}
                  />
                </label>
                <label className="field">
                  <span>Name Override</span>
                  <input
                    value={selectedInputSprite.nameOverride ?? ""}
                    onChange={(event) => updateSelectedSpriteMetadata({ nameOverride: event.target.value })}
                    placeholder={selectedInputSprite.originalName}
                  />
                </label>
                <label className="field">
                  <span>Group</span>
                  <input
                    value={selectedInputSprite.group}
                    onChange={(event) => updateSelectedSpriteMetadata({ group: event.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Pivot X</span>
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    value={selectedInputSprite.pivotX}
                    onChange={(event) => updateSelectedSpriteMetadata({ pivotX: Number(event.target.value) })}
                  />
                </label>
                <label className="field">
                  <span>Pivot Y</span>
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    value={selectedInputSprite.pivotY}
                    onChange={(event) => updateSelectedSpriteMetadata({ pivotY: Number(event.target.value) })}
                  />
                </label>
                <div className="pivotPresetRow">
                  <button type="button" onClick={() => setSelectedPivot(0.5, 0.5)}>Center</button>
                  <button type="button" onClick={() => setSelectedPivot(0.5, 1)}>Bottom</button>
                  <button type="button" onClick={() => setSelectedPivot(0, 0)}>Top Left</button>
                  <button type="button" onClick={() => setSelectedPivot(0.5, 0)}>Top</button>
                  <button type="button" onClick={() => setSelectedPivot(0, 1)}>Bottom Left</button>
                </div>
                <label className="field tagsField">
                  <span>Tags</span>
                  <input
                    value={selectedInputSprite.tags.join(", ")}
                    onChange={(event) => updateSelectedSpriteMetadata({
                      tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean)
                    })}
                  />
                </label>
                <label className="field">
                  <span>Trim Mode</span>
                  <select value={selectedInputSprite.trimMode} onChange={(event) => updateSelectedTrimMode(event.target.value as SpriteTrimMode)}>
                    <option value="default">Default</option>
                    <option value="auto">Auto Trim</option>
                    <option value="none">No Trim</option>
                    <option value="manual">Manual Crop</option>
                  </select>
                </label>
                <div className="cropButtonRow">
                  <button type="button" onClick={useFullImageCrop}>Use Full Image</button>
                  <button type="button" onClick={useCurrentAutoTrimCrop}>Use Auto Trim</button>
                  <button type="button" onClick={centerSelectedCrop}>Center Crop</button>
                  <button type="button" onClick={applySelectedCrop}>Apply Crop</button>
                  <button type="button" onClick={resetCrop}>Reset Crop</button>
                  <button type="button" onClick={validateSelectedCrop}>Validate Crop</button>
                </div>
                <div className="cropInputGrid">
                  <label className="field">
                    <span>Crop X</span>
                    <input
                      type="number"
                      min={0}
                      value={selectedInputSprite.crop?.x ?? ""}
                      onChange={(event) => updateSelectedCrop({ x: Number(event.target.value) })}
                    />
                  </label>
                  <label className="field">
                    <span>Crop Y</span>
                    <input
                      type="number"
                      min={0}
                      value={selectedInputSprite.crop?.y ?? ""}
                      onChange={(event) => updateSelectedCrop({ y: Number(event.target.value) })}
                    />
                  </label>
                  <label className="field">
                    <span>Crop W</span>
                    <input
                      type="number"
                      min={1}
                      value={selectedInputSprite.crop?.w ?? ""}
                      onChange={(event) => updateSelectedCrop({ w: Number(event.target.value) })}
                    />
                  </label>
                  <label className="field">
                    <span>Crop H</span>
                    <input
                      type="number"
                      min={1}
                      value={selectedInputSprite.crop?.h ?? ""}
                      onChange={(event) => updateSelectedCrop({ h: Number(event.target.value) })}
                    />
                  </label>
                </div>
                <SourceCropEditor
                  sprite={selectedInputSprite}
                  preview={sourcePreview}
                  error={sourcePreviewError}
                  zoom={options.previewZoom}
                  mode={previewMode}
                  onCropCommit={(crop) => commitVisualCrop(selectedInputSprite, crop)}
                  onPivotCommit={(pivot) => commitVisualPivot(selectedInputSprite, pivot)}
                />
                {selectedInputSprite.validationMessage && (
                  <div className="validationBox cropValidation">{selectedInputSprite.validationMessage}</div>
                )}
              </div>
            ) : (
              <div className="metadataEmptyState">Scan the input folder to edit per-sprite metadata.</div>
            )}
          </div>

          <SpriteMetadataTable
            sprites={filteredInputSprites}
            selectedPath={selectedInputPath}
            selectedPaths={selectedInputPaths}
            onSelect={handleInputSpriteSelect}
            onToggleInclude={toggleInputSpriteInclude}
            onUpdate={updateInputSpriteMetadata}
            onMove={moveSpriteOrder}
          />

          <div className="exportedSpriteHeader">
            <span>Exported Rects</span>
            <span>{filteredSprites.length}</span>
          </div>
          <SpriteTable sprites={filteredSprites} selectedName={selectedSpriteName} onSelect={handleSpriteSelect} />
        </section>

        <section className="panel logPanel">
          <div className="panelHeader">
            <h2>Log</h2>
            <span>{result?.logPath ? "export log" : "idle"}</span>
          </div>
          <pre>{logText || statusText}</pre>
        </section>
      </main>
    </div>
  );
}

function fullImageCrop(sprite: GuiInputSpriteScanItem): SpriteCropRect {
  return {
    x: 0,
    y: 0,
    w: sprite.sourceW,
    h: sprite.sourceH
  };
}

interface SourceCropEditorProps {
  sprite: GuiInputSpriteScanItem;
  preview: GuiSourceImagePreview | null;
  error: string;
  zoom: number;
  mode: PreviewMode;
  onCropCommit(crop: SpriteCropRect): void;
  onPivotCommit(pivot: { pivotX: number; pivotY: number }): void;
}

type CropDragOperation =
  | { kind: "move"; pointerId: number; startPoint: { x: number; y: number }; startCrop: SpriteCropRect }
  | { kind: "resize"; pointerId: number; handle: CropResizeHandle; startPoint: { x: number; y: number }; startCrop: SpriteCropRect }
  | { kind: "pivot"; pointerId: number };

function SourceCropEditor({ sprite, preview, error, zoom, mode, onCropCommit, onPivotCommit }: SourceCropEditorProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const sourceW = preview?.width ?? sprite.sourceW;
  const sourceH = preview?.height ?? sprite.sourceH;
  const effectiveCrop = getEffectiveCropRect(sprite.crop, sprite.autoTrimRect, sprite.trimMode, Math.max(1, sourceW), Math.max(1, sourceH));
  const [draftCrop, setDraftCrop] = useState<SpriteCropRect>(effectiveCrop);
  const [draftPivot, setDraftPivot] = useState({ pivotX: sprite.pivotX, pivotY: sprite.pivotY });
  const [operation, setOperation] = useState<CropDragOperation | null>(null);
  const valid = validateSpriteCropRect(draftCrop, Math.max(1, sourceW), Math.max(1, sourceH)).valid;
  const canEdit = Boolean(preview) && sprite.status !== "missing" && sourceW > 0 && sourceH > 0;
  const scale = mode === "fit" ? 1 : Math.min(8, Math.max(0.25, zoom));
  const rectStyle = {
    left: `${(draftCrop.x / Math.max(1, sourceW)) * 100}%`,
    top: `${(draftCrop.y / Math.max(1, sourceH)) * 100}%`,
    width: `${(draftCrop.w / Math.max(1, sourceW)) * 100}%`,
    height: `${(draftCrop.h / Math.max(1, sourceH)) * 100}%`
  };
  const pivotPoint = calculatePivotPointInCrop(draftCrop, draftPivot.pivotX, draftPivot.pivotY);
  const pivotStyle = {
    left: `${(pivotPoint.x / Math.max(1, sourceW)) * 100}%`,
    top: `${(pivotPoint.y / Math.max(1, sourceH)) * 100}%`
  };
  const stageStyle = mode === "fit"
    ? {
      width: sourceW,
      aspectRatio: `${sourceW} / ${sourceH}`
    }
    : {
      width: sourceW * scale,
      height: sourceH * scale
    };

  useEffect(() => {
    setDraftCrop(effectiveCrop);
    setDraftPivot({ pivotX: sprite.pivotX, pivotY: sprite.pivotY });
    setOperation(null);
  }, [
    effectiveCrop.x,
    effectiveCrop.y,
    effectiveCrop.w,
    effectiveCrop.h,
    sprite.pivotX,
    sprite.pivotY,
    sprite.relativePath
  ]);

  function getSourcePoint(event: React.PointerEvent<HTMLDivElement>) {
    const stage = stageRef.current;

    if (!stage) {
      return { x: 0, y: 0 };
    }

    const rect = stage.getBoundingClientRect();
    return sourcePointFromPreviewPoint(
      event.clientX - rect.left,
      event.clientY - rect.top,
      Math.max(1, sourceW),
      Math.max(1, sourceH),
      rect.width,
      rect.height
    );
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!canEdit) {
      return;
    }

    const target = event.target as HTMLElement;
    const role = target.dataset.cropRole;
    const point = getSourcePoint(event);

    if (role === "resize") {
      setOperation({
        kind: "resize",
        pointerId: event.pointerId,
        handle: target.dataset.handle as CropResizeHandle,
        startPoint: point,
        startCrop: draftCrop
      });
    } else if (role === "pivot") {
      setOperation({ kind: "pivot", pointerId: event.pointerId });
      setDraftPivot(calculatePivotFromCropPoint(draftCrop, point.x, point.y));
    } else if (role === "move") {
      setOperation({
        kind: "move",
        pointerId: event.pointerId,
        startPoint: point,
        startCrop: draftCrop
      });
    } else {
      return;
    }

    event.preventDefault();
    stageRef.current?.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!operation) {
      return;
    }

    const point = getSourcePoint(event);

    if (operation.kind === "move") {
      setDraftCrop(moveCropRect(
        operation.startCrop,
        point.x - operation.startPoint.x,
        point.y - operation.startPoint.y,
        Math.max(1, sourceW),
        Math.max(1, sourceH)
      ));
    } else if (operation.kind === "resize") {
      setDraftCrop(resizeCropRect(
        operation.startCrop,
        operation.handle,
        point.x - operation.startPoint.x,
        point.y - operation.startPoint.y,
        Math.max(1, sourceW),
        Math.max(1, sourceH)
      ));
    } else {
      setDraftPivot(calculatePivotFromCropPoint(draftCrop, point.x, point.y));
    }
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (!operation) {
      return;
    }

    if (operation.kind === "pivot") {
      onPivotCommit(draftPivot);
    } else {
      onCropCommit(draftCrop);
    }

    setOperation(null);
    stageRef.current?.releasePointerCapture(event.pointerId);
  }

  function cancelDraft() {
    setDraftCrop(effectiveCrop);
    setDraftPivot({ pivotX: sprite.pivotX, pivotY: sprite.pivotY });
  }

  return (
    <div className="cropPreviewBlock">
      <div className="cropPreviewInfo">
        <span>{sourceW}x{sourceH}</span>
        <span>{sprite.trimMode === "manual" ? "Manual crop" : `Preview: ${sprite.trimMode}`}</span>
        <span>{valid ? "Crop OK" : "Invalid crop"}</span>
      </div>
      <div className="sourcePreviewToolbar">
        <button type="button" onClick={() => onCropCommit(draftCrop)} disabled={!canEdit}>Apply Crop</button>
        <button type="button" onClick={cancelDraft} disabled={!canEdit}>Cancel Crop Edit</button>
      </div>
      <div className="cropPreviewCanvas sourcePreviewCanvas">
        {preview ? (
          <div
            ref={stageRef}
            className={mode === "fit" ? "sourcePreviewStage fit" : "sourcePreviewStage"}
            style={stageStyle}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={() => setOperation(null)}
          >
            <img src={preview.url} alt={sprite.relativePath} />
            <div
              className={valid ? "cropPreviewRect interactive" : "cropPreviewRect interactive invalid"}
              style={rectStyle}
              data-crop-role="move"
              title="Drag crop"
            />
            {(["nw", "ne", "sw", "se", "n", "s", "e", "w"] as CropResizeHandle[]).map((handle) => (
              <div
                key={handle}
                className={`cropHandle ${handle}`}
                style={cropHandleStyle(handle, draftCrop, sourceW, sourceH)}
                data-crop-role="resize"
                data-handle={handle}
                title={`Resize ${handle}`}
              />
            ))}
            <div
              className="sourcePivotMarker"
              style={pivotStyle}
              data-crop-role="pivot"
              title="Drag pivot"
            />
          </div>
        ) : (
          <div className="emptyState">{error || "Loading source preview..."}</div>
        )}
      </div>
    </div>
  );
}

function cropHandleStyle(
  handle: CropResizeHandle,
  crop: SpriteCropRect,
  sourceW: number,
  sourceH: number
) {
  const x = handle.includes("w")
    ? crop.x
    : handle.includes("e")
      ? crop.x + crop.w
      : crop.x + crop.w / 2;
  const y = handle.includes("n")
    ? crop.y
    : handle.includes("s")
      ? crop.y + crop.h
      : crop.y + crop.h / 2;

  return {
    left: `${(x / Math.max(1, sourceW)) * 100}%`,
    top: `${(y / Math.max(1, sourceH)) * 100}%`
  };
}
