import { AlertTriangle, CheckCircle2, Clock, Eraser, ExternalLink, FileJson, FilePlus, Files, FileText, FolderOpen, HelpCircle, Play, RotateCcw, Save, Trash2, Wand2, X } from "lucide-react";
import { type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  AppLanguage,
  GuiAtlasJson,
  GuiAtlasJsonSprite,
  GuiBatchExportResult,
  GuiBatchSet,
  GuiExportOptions,
  GuiExportResult,
  GuiInputSpriteScanItem,
  GuiProfileId,
  GuiProjectFile,
  GuiProjectLoadResult,
  GuiProjectSaveResult,
  GuiRecentItemKind,
  GuiRecentItems,
  GuiSettings,
  LinuxUpdateStatus,
  GuiSourceImagePreview,
  GuiWatchEvent,
  SpriteCropRect,
  SpriteMetadataEntry,
  SpriteTrimMode
} from "../shared/gui-types";
import {
  DEFAULT_GUI_LAYOUT,
  clampGuiLayoutValue,
  getPreviewEmptyReason,
  normalizeGuiLayoutSettings,
  type GuiLayoutSettings,
  type RightPanelTab
} from "../shared/gui-layout";
import {
  DEFAULT_GUI_SETTINGS,
  addTagsForSprites,
  assignSequentialOrderForSprites,
  buildExportResultSummary,
  clampPivotValue,
  classifyGuiError,
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
  reorderVisibleInputSpriteOrder,
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
import { getErrorGuide } from "../shared/error-guide";
import { buildExportValidationDisplay } from "../shared/export-result";
import { createBatchSet } from "../shared/batch-set";
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
  createEditorHistory,
  markEditorHistorySaved,
  pushEditorHistory,
  replaceEditorHistoryPresent,
  redoEditorHistory,
  resetEditorHistory,
  undoEditorHistory
} from "../shared/history";
import type { PackingAlgorithm } from "../shared/packing";
import type { SizeMode } from "../shared/sizeMode";
import { resolveRendererLanguage } from "./i18n";
import {
  addRecentPath,
  applyProfilePreset,
  createProjectFile,
  getProfilePreset,
  PROFILE_PRESETS,
  projectToSettings
} from "../shared/project";
import { LanguageSelector } from "./components/i18n/LanguageSelector";
import { PreviewPanel, type PreviewMode } from "./components/PreviewPanel";
import { SpriteMetadataTable } from "./components/SpriteMetadataTable";
import { SpriteTable } from "./components/SpriteTable";

type StatusKind = "idle" | "running" | "success" | "error";
type SplitterKind = "left" | "right" | "bottom";
type HelpTab = "quickStart" | "basics" | "unity" | "monogame" | "troubleshooting" | "files";

interface LayoutDragState {
  kind: SplitterKind;
  startX: number;
  startY: number;
  startLayout: GuiLayoutSettings;
}

interface CurrentErrorGuide {
  message: string;
  actions: string[];
}

const HELP_TABS: HelpTab[] = ["quickStart", "basics", "unity", "monogame", "troubleshooting", "files"];
const HELP_ITEM_KEYS: Record<HelpTab, string[]> = {
  quickStart: ["one", "two", "three", "four"],
  basics: ["one", "two", "three"],
  unity: ["one", "two", "three"],
  monogame: ["one", "two", "three"],
  troubleshooting: ["one", "two", "three"],
  files: ["one", "two", "three", "four"]
};

function serializeEditorSettings(settings: GuiSettings): string {
  return JSON.stringify(createProjectFile(settings));
}

export function App() {
  const { t, i18n } = useTranslation([
    "batch",
    "common",
    "diagnostics",
    "errors",
    "help",
    "metadata",
    "options",
    "preview",
    "project",
    "sprites",
    "updates",
    "watch"
  ]);
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
  const [recentItems, setRecentItems] = useState<GuiRecentItems>({ projects: [], inputDirs: [], outputDirs: [] });
  const [appVersion, setAppVersion] = useState("0.1.0");
  const [lastExportAt, setLastExportAt] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("fit");
  const [watchText, setWatchText] = useState("Off");
  const [lastWatchAt, setLastWatchAt] = useState<string | null>(null);
  const [batchResult, setBatchResult] = useState<GuiBatchExportResult | null>(null);
  const [currentBatchSetPath, setCurrentBatchSetPath] = useState<string | null>(null);
  const [batchSetName, setBatchSetName] = useState("Batch Set");
  const [batchSetProjectsText, setBatchSetProjectsText] = useState("");
  const [batchSetFailFast, setBatchSetFailFast] = useState(false);
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
  const [layoutDrag, setLayoutDrag] = useState<LayoutDragState | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpTab, setHelpTab] = useState<HelpTab>("quickStart");
  const [currentErrorGuide, setCurrentErrorGuide] = useState<CurrentErrorGuide | null>(null);
  const [updateStatus, setUpdateStatus] = useState<LinuxUpdateStatus>({ state: "idle", supported: false });

  const validation = useMemo(() => validateGuiExportOptions(options), [options]);
  const localizedValidationErrors = useMemo(() => localizeValidationErrors(validation.errors, t), [t, validation.errors]);
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
  const exportResultSummary = useMemo(
    () => result ? buildExportResultSummary(result) : null,
    [result]
  );
  const exportValidationDisplay = useMemo(
    () => result ? buildExportValidationDisplay(result.validation) : null,
    [result]
  );
  const previewEmptyReason = useMemo(() => getPreviewEmptyReason({
    hasInput: Boolean(options.inputDir.trim()),
    hasOutput: Boolean(options.outputDir.trim()),
    spriteCount: editorInputSprites.length,
    hasAtlas: pageCount > 0,
    hasError: status === "error"
  }), [editorInputSprites.length, options.inputDir, options.outputDir, pageCount, status]);
  const activeLanguage = resolveRendererLanguage(options.language);
  const statusLabel = localizeStatusText(statusText, t);
  const scanLabel = localizeScanText(scanText, t);
  const appVersionLabel = appVersion.replace(/^v/i, "");
  const workspaceStyle = useMemo<CSSProperties>(() => ({
    gridTemplateColumns: [
      options.layout.leftPanelOpen ? `${options.layout.leftPanelWidth}px` : "0px",
      options.layout.leftPanelOpen ? "8px" : "0px",
      "minmax(280px, 1fr)",
      options.layout.rightPanelOpen ? "8px" : "0px",
      options.layout.rightPanelOpen ? `${options.layout.rightPanelWidth}px` : "0px"
    ].join(" "),
    gridTemplateRows: `minmax(0, 1fr) ${options.layout.statusPanelOpen ? "8px" : "0px"} ${options.layout.statusPanelOpen ? `${options.layout.bottomStatusHeight}px` : "46px"}`
  }), [
    options.layout.bottomStatusHeight,
    options.layout.leftPanelOpen,
    options.layout.leftPanelWidth,
    options.layout.rightPanelOpen,
    options.layout.rightPanelWidth,
    options.layout.statusPanelOpen
  ]);
  const statusSummary = status === "error"
    ? statusLabel
    : t("diagnostics:summary.ready", {
      status: statusLabel,
      sprites: editorInputSprites.length,
      lastExport: lastExportAt ?? t("diagnostics:summary.noExport")
    });
  const batchSetProjects = useMemo(
    () => batchSetProjectsText.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
    [batchSetProjectsText]
  );
  const currentBatchSet = useMemo(
    () => createBatchSet(batchSetName, batchSetProjects, {
      failFast: batchSetFailFast,
      schedule: {
        enabled: false,
        mode: "manual",
        note: "Saved for future scheduling support."
      }
    }),
    [batchSetFailFast, batchSetName, batchSetProjects]
  );

  useEffect(() => {
    void loadInitialState();
  }, []);

  useEffect(() => {
    if (!settingsLoaded) {
      return;
    }

    const nextLanguage = resolveRendererLanguage(options.language);
    document.documentElement.lang = nextLanguage;

    if (i18n.language !== nextLanguage) {
      void i18n.changeLanguage(nextLanguage);
    }

    void window.suwolAtlas.setLanguage(options.language);
  }, [i18n, options.language, settingsLoaded]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === "1") {
        event.preventDefault();
        togglePanel("left");
      } else if (key === "2") {
        event.preventDefault();
        togglePanel("right");
      } else if (key === "3") {
        event.preventDefault();
        togglePanel("status");
      } else if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if (key === "y" || (key === "z" && event.shiftKey)) {
        event.preventDefault();
        redo();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [options.layout, status]);

  useEffect(() => {
    if (!layoutDrag) {
      return;
    }

    const activeDrag = layoutDrag;

    function handlePointerMove(event: PointerEvent) {
      event.preventDefault();
      const deltaX = event.clientX - activeDrag.startX;
      const deltaY = event.clientY - activeDrag.startY;
      const nextLayout = { ...activeDrag.startLayout };

      if (activeDrag.kind === "left") {
        nextLayout.leftPanelWidth = clampGuiLayoutValue("leftPanelWidth", activeDrag.startLayout.leftPanelWidth + deltaX);
      } else if (activeDrag.kind === "right") {
        nextLayout.rightPanelWidth = clampGuiLayoutValue("rightPanelWidth", activeDrag.startLayout.rightPanelWidth - deltaX);
      } else {
        nextLayout.bottomStatusHeight = clampGuiLayoutValue("bottomStatusHeight", activeDrag.startLayout.bottomStatusHeight - deltaY);
      }

      updateLayout(nextLayout);
    }

    function handlePointerUp() {
      setLayoutDrag(null);
    }

    document.body.classList.add("isResizing");
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      document.body.classList.remove("isResizing");
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [layoutDrag]);

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
    } else if (command === "action:scan") {
      void scanInputSprites();
    } else if (command === "action:export") {
      void runExport();
    } else if (command === "view:toggleProject") {
      togglePanel("left");
    } else if (command === "view:toggleSprites") {
      togglePanel("right");
    } else if (command === "view:toggleStatus") {
      togglePanel("status");
    } else if (command === "view:resetLayout") {
      resetWorkspaceLayout();
    } else if (command === "view:resetWorkspace") {
      resetWorkspace();
    } else if (command === "view:resetPanelSizes") {
      resetPanelSizes();
    } else if (command === "view:resetFilters") {
      resetInputFilters();
    } else if (command === "help:guide") {
      openGuide("quickStart");
    } else if (command === "help:troubleshooting") {
      openGuide("troubleshooting");
    } else if (command === "updates:check") {
      void checkLinuxUpdates(true);
    } else if (command === "maintenance:clearCache") {
      void clearKnownAtlasCaches();
    } else if (command === "maintenance:cleanRecent") {
      void cleanRecentWithConfirmation();
    } else if (command === "edit:undo") {
      undo();
    } else if (command === "edit:redo") {
      redo();
    }
  }), [currentProjectPath, options]);

  useEffect(() => {
    const removeStateListener = window.suwolAtlas.updates.onStateChanged((nextStatus) => {
      applyLinuxUpdateStatus(nextStatus, shouldAnnounceUpdateStatus(nextStatus));
    });
    const removeProgressListener = window.suwolAtlas.updates.onProgress((progress) => {
      setUpdateStatus((current) => ({
        ...current,
        state: "downloading",
        progress
      }));
    });
    const removeErrorListener = window.suwolAtlas.updates.onError((nextStatus) => {
      applyLinuxUpdateStatus(nextStatus, true);
    });

    return () => {
      removeStateListener();
      removeProgressListener();
      removeErrorListener();
    };
  }, [t]);

  useEffect(() => {
    if (!selectedInputSprite || selectedInputSprite.status === "missing" || !options.inputDir.trim()) {
      setSourcePreview(null);
      setSourcePreviewError(selectedInputSprite?.status === "missing" ? t("errors:sourcePreview.missing") : "");
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
      updateLayout({ statusPanelOpen: true });
    });

    return () => {
      void window.suwolAtlas.stopWatch();
    };
  }, [options, settingsLoaded, validation.valid]);

  async function loadInitialState() {
    const [settings, version, initialUpdateStatus] = await Promise.all([
      window.suwolAtlas.loadSettings(),
      window.suwolAtlas.getVersion(),
      window.suwolAtlas.updates.getState()
    ]);
    const normalized = normalizeGuiSettings(settings);

    setHistory((current) => resetEditorHistory(current, normalized, { serialize: serializeEditorSettings }));
    setCurrentProjectPath(normalized.lastProjectPath);
    setSavedProject(createProjectFile(normalized));
    const items = await window.suwolAtlas.listRecentItems();
    setRecentItems(items);
    setRecentProjects(items.projects.map((item) => item.path));
    setAppVersion(version);
    setUpdateStatus(initialUpdateStatus);
    setSettingsLoaded(true);

    if (normalized.updates.linuxAutoCheck && initialUpdateStatus.supported) {
      void checkLinuxUpdates(false);
    }
  }

  async function refreshRecentItems() {
    const items = await window.suwolAtlas.listRecentItems();
    setRecentItems(items);
    setRecentProjects(items.projects.map((item) => item.path));
  }

  function applyRecentItems(items: GuiRecentItems) {
    setRecentItems(items);
    setRecentProjects(items.projects.map((item) => item.path));
    updateUiSettings({
      recentProjectPaths: items.projects.map((item) => item.path),
      recentInputDirs: items.inputDirs.map((item) => item.path),
      recentOutputDirs: items.outputDirs.map((item) => item.path)
    });
  }

  async function chooseInput() {
    const directory = await window.suwolAtlas.selectInputDirectory();

    if (directory) {
      updateOptions({
        inputDir: directory,
        recentInputDirs: addRecentPath(options.recentInputDirs, directory)
      });
      void refreshRecentItems();
    }
  }

  async function chooseOutput() {
    const directory = await window.suwolAtlas.selectOutputDirectory();

    if (directory) {
      updateOptions({
        outputDir: directory,
        recentOutputDirs: addRecentPath(options.recentOutputDirs, directory)
      });
      void refreshRecentItems();
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
      const message = formatError(error);
      setScanText(message);
      setStatus("error");
      setStatusText(message);
      updateLayout({ statusPanelOpen: true });
    }
  }

  async function newProject() {
    const project = await window.suwolAtlas.newProject();
    applyProject(null, project, []);
    setStatus("idle");
    setStatusText(t("diagnostics:status.newProject"));
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

  async function openSampleProject() {
    try {
      const project = await window.suwolAtlas.openSampleProject();
      await handleProjectLoaded(project);
      setStatus("success");
      setStatusText(t("project:sample.loaded"));
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
      await refreshRecentItems();
    }
  }

  function openRecentInput(inputDir: string) {
    updateOptions({
      inputDir,
      recentInputDirs: addRecentPath(options.recentInputDirs, inputDir)
    });
  }

  function openRecentOutput(outputDir: string) {
    updateOptions({
      outputDir,
      recentOutputDirs: addRecentPath(options.recentOutputDirs, outputDir)
    });
  }

  async function cleanRecent(kind?: GuiRecentItemKind) {
    if (!window.confirm(t("project:maintenance.recentConfirm"))) {
      return;
    }

    try {
      applyRecentItems(await window.suwolAtlas.cleanRecentItems(kind));
      setStatus("success");
      setStatusText(t("project:maintenance.recentDone"));
    } catch (error) {
      showError(error);
    }
  }

  async function clearRecent(kind?: GuiRecentItemKind) {
    if (!window.confirm(t("project:maintenance.recentConfirm"))) {
      return;
    }

    applyRecentItems(await window.suwolAtlas.clearRecentItems(kind));
  }

  async function cleanRecentWithConfirmation() {
    await cleanRecent();
  }

  async function clearKnownAtlasCaches() {
    if (!window.confirm(t("project:maintenance.cacheConfirm"))) {
      return;
    }

    const knownOutputDirs = [
      options.outputDir,
      ...options.recentOutputDirs,
      ...recentItems.outputDirs.map((item) => item.path)
    ].filter((item, index, all) => item.trim() && all.findIndex((candidate) => candidate.toLowerCase() === item.toLowerCase()) === index);

    try {
      const cleared = await window.suwolAtlas.clearAtlasCaches(knownOutputDirs);
      setStatus("success");
      setStatusText(t("project:maintenance.cacheDone", { count: cleared.deleted }));
      setLogText(cleared.paths.join("\n"));
    } catch (error) {
      showError(error);
    }
  }

  async function checkLinuxUpdates(announce: boolean) {
    if (announce) {
      setStatus("running");
      setStatusText(t("updates:checking"));
      updateLayout({ statusPanelOpen: true });
    }

    try {
      const nextStatus = await window.suwolAtlas.updates.check();
      applyLinuxUpdateStatus(nextStatus, announce || shouldAnnounceUpdateStatus(nextStatus));
    } catch (error) {
      showUpdateError(error);
    }
  }

  async function downloadLinuxUpdate() {
    setStatus("running");
    setStatusText(t("updates:downloading"));
    updateLayout({ statusPanelOpen: true });

    try {
      const nextStatus = await window.suwolAtlas.updates.download();
      applyLinuxUpdateStatus(nextStatus, true);
    } catch (error) {
      showUpdateError(error);
    }
  }

  async function installLinuxUpdate() {
    try {
      await window.suwolAtlas.updates.install();
    } catch (error) {
      showUpdateError(error);
    }
  }

  async function setLinuxUpdatesEnabled(enabled: boolean) {
    updateUiSettings({
      updates: {
        ...options.updates,
        linuxEnabled: enabled
      }
    });

    try {
      const nextStatus = await window.suwolAtlas.updates.setEnabled(enabled);
      applyLinuxUpdateStatus(nextStatus, true);
    } catch (error) {
      showUpdateError(error);
    }
  }

  function setLinuxAutoCheck(enabled: boolean) {
    updateUiSettings({
      updates: {
        ...options.updates,
        linuxAutoCheck: enabled
      }
    });
  }

  function applyLinuxUpdateStatus(nextStatus: LinuxUpdateStatus, announce: boolean) {
    setUpdateStatus(nextStatus);

    if (!announce) {
      return;
    }

    setStatus(nextStatus.state === "error" ? "error" : nextStatus.state === "checking" || nextStatus.state === "downloading" ? "running" : "success");
    setStatusText(getLinuxUpdateMessage(nextStatus));
    updateLayout({ statusPanelOpen: true });

    if (nextStatus.state === "error") {
      setLogText((current) => [
        current,
        `${t("errors:details.userMessage")}: ${t("updates:error")}`,
        `${t("updates:technical.hint")}`,
        nextStatus.technicalDetail ? `${t("errors:details.technicalMessage")}:\n${nextStatus.technicalDetail}` : undefined
      ].filter(Boolean).join("\n"));
    }
  }

  function showUpdateError(error: unknown) {
    const raw = formatError(error);

    setStatus("error");
    setStatusText(t("updates:error"));
    setLogText((current) => [
      current,
      `${t("errors:details.userMessage")}: ${t("updates:error")}`,
      `${t("updates:technical.hint")}`,
      `${t("errors:details.technicalMessage")}: ${raw}`
    ].filter(Boolean).join("\n"));
    updateLayout({ statusPanelOpen: true });
  }

  function shouldAnnounceUpdateStatus(nextStatus: LinuxUpdateStatus): boolean {
    return nextStatus.state === "available" || nextStatus.state === "downloaded" || nextStatus.state === "error";
  }

  function getLinuxUpdateMessage(nextStatus: LinuxUpdateStatus): string {
    if (nextStatus.state === "unsupported") {
      return nextStatus.reason
        ? `${t("updates:unsupported")} ${t(`updates:reason.${nextStatus.reason}`)}`
        : t("updates:unsupported");
    }

    if (nextStatus.state === "available" && nextStatus.availableVersion) {
      return `${t("updates:available")} ${t("updates:availableVersion", { version: nextStatus.availableVersion })}`;
    }

    if (nextStatus.state === "downloaded") {
      return nextStatus.downloadedVersion
        ? `${t("updates:downloaded")} ${t("updates:availableVersion", { version: nextStatus.downloadedVersion })}`
        : t("updates:downloaded");
    }

    if (nextStatus.state === "downloading" && nextStatus.progress) {
      return `${t("updates:downloading")} ${t("updates:downloadProgress", { percent: Math.round(nextStatus.progress.percent) })}`;
    }

    switch (nextStatus.state) {
      case "checking":
        return t("updates:checking");
      case "not-available":
        return t("updates:notAvailable");
      case "error":
        return t("updates:error");
      case "idle":
      default:
        return t("diagnostics:status.ready");
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
      showError(new Error(currentValidation.errors[0]));
      setLogText((current) => [
        current,
        currentValidation.errors.join("\n")
      ].filter(Boolean).join("\n"));
      return;
    }

    setStatus("running");
    setStatusText(t("diagnostics:status.exporting"));
    setCurrentErrorGuide(null);

    try {
      const exportOptions: GuiExportOptions = {
        ...buildExportOptions()
      };
      const nextResult = await window.suwolAtlas.exportAtlas(exportOptions);
      await applyExportResult(nextResult, t("diagnostics:export.exported"));
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

      setBatchSetProjectsText(paths.join("\n"));
      setStatus("running");
      setStatusText(t("diagnostics:status.batchRunning"));
      const nextBatch = await window.suwolAtlas.runBatchExport(paths);
      setBatchResult(nextBatch);
      setStatus(nextBatch.failed > 0 ? "error" : "success");
      setStatusText(t("batch:summary", { succeeded: nextBatch.succeeded, total: nextBatch.total }));
      if (nextBatch.failed > 0) {
        updateLayout({ statusPanelOpen: true });
      }
    } catch (error) {
      showError(error);
    }
  }

  async function chooseBatchSetProjects() {
    try {
      const paths = await window.suwolAtlas.selectBatchTargets();

      if (!paths || paths.length === 0) {
        return;
      }

      setBatchSetProjectsText(paths.join("\n"));
      setStatus("idle");
      setStatusText(t("batch:status.projectsSelected", { count: paths.length }));
    } catch (error) {
      showError(error);
    }
  }

  async function addBatchSetProjects() {
    try {
      const paths = await window.suwolAtlas.selectBatchTargets();

      if (!paths || paths.length === 0) {
        return;
      }

      const existing = new Set(batchSetProjects.map((item) => item.toLowerCase()));
      const next = [
        ...batchSetProjects,
        ...paths.filter((item) => {
          const key = item.toLowerCase();
          if (existing.has(key)) {
            return false;
          }
          existing.add(key);
          return true;
        })
      ];
      setBatchSetProjectsText(next.join("\n"));
      setStatus("idle");
      setStatusText(t("batch:status.projectsSelected", { count: next.length }));
    } catch (error) {
      showError(error);
    }
  }

  function removeBatchSetProject(projectPath: string) {
    setBatchSetProjectsText(batchSetProjects.filter((item) => item !== projectPath).join("\n"));
  }

  async function openBatchSet() {
    try {
      const result = await window.suwolAtlas.openBatchSetDialog();

      if (!result) {
        return;
      }

      applyBatchSet(result.path, result.batchSet, result.warnings);
    } catch (error) {
      showError(error);
    }
  }

  async function saveBatchSet(forceSaveAs: boolean) {
    try {
      const request = {
        path: currentBatchSetPath,
        batchSet: currentBatchSet
      };
      const saved = forceSaveAs || !currentBatchSetPath
        ? await window.suwolAtlas.saveBatchSetAs(request)
        : await window.suwolAtlas.saveBatchSet(request);

      if (saved) {
        applyBatchSet(saved.path, saved.batchSet, []);
        setStatus("success");
        setStatusText(t("batch:status.saved"));
      }
    } catch (error) {
      showError(error);
    }
  }

  async function runCurrentBatchSet() {
    if (batchSetProjects.length === 0) {
      setStatus("error");
      setStatusText(t("batch:status.emptySet"));
      updateLayout({ statusPanelOpen: true });
      return;
    }

    try {
      setStatus("running");
      setStatusText(t("diagnostics:status.batchRunning"));
      const nextBatch = await window.suwolAtlas.runBatchSet({
        path: currentBatchSetPath,
        batchSet: currentBatchSet
      });
      setBatchResult(nextBatch);
      setStatus(nextBatch.failed > 0 ? "error" : "success");
      setStatusText(t("batch:summary", { succeeded: nextBatch.succeeded, total: nextBatch.total }));
      if (nextBatch.failed > 0) {
        updateLayout({ statusPanelOpen: true });
      }
    } catch (error) {
      showError(error);
    }
  }

  function applyBatchSet(batchSetPath: string | null, batchSet: GuiBatchSet, warnings: string[]) {
    setCurrentBatchSetPath(batchSetPath);
    setBatchSetName(batchSet.name);
    setBatchSetProjectsText(batchSet.projects.join("\n"));
    setBatchSetFailFast(batchSet.options.failFast);
    setLogText((current) => [
      current,
      ...warnings.map((warning) => `Warning: ${warning}`)
    ].filter(Boolean).join("\n"));
    setStatus(warnings.length > 0 ? "error" : "success");
    setStatusText(warnings.length > 0 ? warnings.join(" ") : t("batch:status.loaded"));
    if (warnings.length > 0) {
      updateLayout({ statusPanelOpen: true });
    }
  }

  async function handleWatchEvent(event: GuiWatchEvent) {
    setWatchText(event.message);
    setLastWatchAt(new Date(event.at).toLocaleTimeString());

    if (event.kind === "running") {
      setStatus("running");
      setStatusText(event.message);
    } else if (event.kind === "success" && event.result) {
      await applyExportResult(event.result, t("diagnostics:export.autoExported"));
      setWatchText(event.message);
    } else if (event.kind === "error") {
      setStatus("error");
      setStatusText(event.error ?? event.message);
      updateLayout({ statusPanelOpen: true });
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
    setCurrentErrorGuide(null);
    setStatus(nextResult.validation.status === "error" ? "error" : "success");
    setLastExportAt(new Date().toLocaleTimeString());
    setStatusText(nextResult.validation.status === "passed"
      ? t("diagnostics:export.result", {
        verb,
        sprites: nextResult.spriteCount,
        pages: nextResult.previewPages.length
      })
      : t(`diagnostics:validation.${nextResult.validation.status}.title`));
    updateUiSettings({
      layout: {
        ...options.layout,
        statusPanelOpen: true
      },
      recentInputDirs: addRecentPath(options.recentInputDirs, options.inputDir),
      recentOutputDirs: addRecentPath(options.recentOutputDirs, nextResult.outputDir)
    });
    await refreshRecentItems();
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

  async function openOutput(outputDir = options.outputDir) {
    if (!outputDir.trim()) {
      showError(new Error("Output directory path is required."));
      return;
    }

    try {
      await window.suwolAtlas.openOutputDirectory(outputDir);
    } catch (error) {
      showError(error);
    }
  }

  function openGuide(tab: HelpTab) {
    setHelpTab(tab);
    setHelpOpen(true);
  }

  function updateOptions(patch: Partial<GuiSettings>) {
    commitOptions((current) => normalizeGuiSettings({ ...current, ...patch }));
  }

  function updateUiSettings(patch: Partial<GuiSettings>) {
    setHistory((current) => {
      const patchLayout = normalizeGuiLayoutSettings({
        ...current.present.layout,
        ...(patch.layout ?? {}),
        ...(patch.advancedCollapsed === undefined ? {} : { advancedCollapsed: patch.advancedCollapsed }),
        ...(patch.logCollapsed === undefined ? {} : { statusPanelOpen: !patch.logCollapsed }),
        ...(patch.rightPanelTab === undefined ? {} : { rightPanelTab: patch.rightPanelTab })
      });
      const nextPatch = {
        ...patch,
        layout: patchLayout
      };

      return replaceEditorHistoryPresent(current, normalizeGuiSettings({
        ...current.present,
        ...nextPatch
      }));
    });
  }

  function updateLanguage(language: AppLanguage) {
    updateUiSettings({ language });
  }

  function updateLayout(layout: Partial<GuiLayoutSettings>) {
    updateUiSettings({
      layout: {
        ...options.layout,
        ...layout
      }
    });
  }

  function updateRightPanelTab(rightPanelTab: RightPanelTab) {
    updateUiSettings({ rightPanelTab });
  }

  function openRightPanelTab(rightPanelTab: RightPanelTab) {
    updateUiSettings({
      layout: {
        ...options.layout,
        rightPanelOpen: true,
        rightPanelTab
      },
      rightPanelTab
    });
  }

  function togglePanel(panel: "left" | "right" | "status") {
    if (panel === "left") {
      updateLayout({ leftPanelOpen: !options.layout.leftPanelOpen });
    } else if (panel === "right") {
      updateLayout({ rightPanelOpen: !options.layout.rightPanelOpen });
    } else {
      updateLayout({ statusPanelOpen: !options.layout.statusPanelOpen });
    }
  }

  function resetWorkspaceLayout() {
    updateUiSettings({ layout: DEFAULT_GUI_LAYOUT });
  }

  function resetWorkspace() {
    resetInputFilters();
    updateUiSettings({
      layout: DEFAULT_GUI_LAYOUT,
      advancedCollapsed: DEFAULT_GUI_LAYOUT.advancedCollapsed,
      rightPanelTab: DEFAULT_GUI_LAYOUT.rightPanelTab
    });
    setStatus("idle");
    setStatusText(t("common:layout.workspaceReset"));
  }

  function resetPanelSizes() {
    updateLayout({
      leftPanelWidth: DEFAULT_GUI_LAYOUT.leftPanelWidth,
      rightPanelWidth: DEFAULT_GUI_LAYOUT.rightPanelWidth,
      bottomStatusHeight: DEFAULT_GUI_LAYOUT.bottomStatusHeight
    });
    setStatus("idle");
    setStatusText(t("common:layout.panelSizesReset"));
  }

  function beginLayoutResize(kind: SplitterKind, event: ReactPointerEvent<HTMLElement>) {
    event.preventDefault();
    setLayoutDrag({
      kind,
      startX: event.clientX,
      startY: event.clientY,
      startLayout: options.layout
    });
  }

  function resetLayoutSize(kind: SplitterKind) {
    if (kind === "left") {
      updateLayout({ leftPanelWidth: DEFAULT_GUI_LAYOUT.leftPanelWidth });
    } else if (kind === "right") {
      updateLayout({ rightPanelWidth: DEFAULT_GUI_LAYOUT.rightPanelWidth });
    } else {
      updateLayout({ bottomStatusHeight: DEFAULT_GUI_LAYOUT.bottomStatusHeight });
    }
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

    setHistory((current) => {
      const next = undoEditorHistory(current);
      return next === current
        ? current
        : replaceEditorHistoryPresent(next, preserveUiSettings(next.present, current.present));
    });
    setStatus("idle");
    setStatusText(t("diagnostics:status.undo"));
  }

  function redo() {
    if (status === "running") {
      return;
    }

    setHistory((current) => {
      const next = redoEditorHistory(current);
      return next === current
        ? current
        : replaceEditorHistoryPresent(next, preserveUiSettings(next.present, current.present));
    });
    setStatus("idle");
    setStatusText(t("diagnostics:status.redo"));
  }

  function applyPreset() {
    commitOptions((current) => applyProfilePreset(current, current.profile));
  }

  function updateProfile(profile: GuiProfileId) {
    if (options.useRecommendedSettings) {
      commitOptions((current) => applyProfilePreset({ ...current, profile }, profile));
      return;
    }

    updateOptions({ profile });
  }

  function toggleRecommendedSettings(enabled: boolean) {
    if (enabled) {
      commitOptions((current) => applyProfilePreset({
        ...current,
        useRecommendedSettings: true
      }, current.profile));
      return;
    }

    updateOptions({ useRecommendedSettings: false });
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
    openRightPanelTab("selected");

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

  function reorderVisibleSpriteOrder(draggedRelativePath: string, targetRelativePath: string) {
    updateOptions({
      spriteMetadata: reorderVisibleInputSpriteOrder(
        options.spriteMetadata,
        editorInputSprites,
        filteredInputSprites.map((sprite) => sprite.relativePath),
        draggedRelativePath,
        targetRelativePath
      )
    });
    setSelectedInputPath(draggedRelativePath);
    setSelectedInputPaths([draggedRelativePath]);
    setLastSelectedInputPath(draggedRelativePath);
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

    if (!window.confirm(t("metadata:editor.cleanupMissing", { count: missingMetadataCount }))) {
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
    setStatusText(result.valid ? t("metadata:crop.ok") : localizeFriendlyError(result.errors.join(" "), t));
  }

  async function handleProjectLoaded(projectLoad: GuiProjectLoadResult) {
    applyProject(projectLoad.path, projectLoad.project, projectLoad.warnings);
    await refreshRecentItems();
  }

  async function handleProjectSaved(saveResult: GuiProjectSaveResult) {
    setCurrentProjectPath(saveResult.path);
    setSavedProject(saveResult.project);
    setHistory((current) => markEditorHistorySaved(current, serializeEditorSettings));
    await refreshRecentItems();
    setStatus("success");
    setStatusText(t("common:labels.saved"));
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
    setStatusText(warnings.length > 0 ? warnings.join(" ") : t("diagnostics:status.ready"));
  }

  function showError(error: unknown) {
    const raw = formatError(error);
    const classified = classifyGuiError(raw);
    const guide = getErrorGuide(classified.code);
    const friendly = classified.code === "fallback"
      ? t("errors:fallback")
      : t(guide.messageKey);
    setStatus("error");
    setStatusText(friendly);
    setCurrentErrorGuide({
      message: friendly,
      actions: guide.actionKeys.map((key) => t(key))
    });
    setLogText((current) => [
      current,
      `${t("errors:details.userMessage")}: ${friendly}`,
      `${t("errors:details.technicalMessage")}: ${raw}`
    ].filter(Boolean).join("\n"));
    updateLayout({ statusPanelOpen: true });
  }

  function formatError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  function renderTopBar() {
    return (
      <header className="appHeader">
        <div className="brandBlock">
          <h1>
            {t("common:app.name")}
            <span>{t("common:app.version", { version: appVersionLabel })}</span>
          </h1>
        </div>
        <div className="panelToggleBar" role="toolbar" aria-label={t("common:layout.panelToggles")}>
          <button
            type="button"
            className={options.layout.leftPanelOpen ? "toggleButton active" : "toggleButton"}
            title={t("common:layout.projectShortcut")}
            aria-pressed={options.layout.leftPanelOpen}
            onClick={() => togglePanel("left")}
          >
            {t("common:layout.project")}
          </button>
          <button
            type="button"
            className={options.layout.rightPanelOpen ? "toggleButton active" : "toggleButton"}
            title={t("common:layout.spritesShortcut")}
            aria-pressed={options.layout.rightPanelOpen}
            onClick={() => togglePanel("right")}
          >
            {t("common:layout.sprites")}
          </button>
          <button
            type="button"
            className={options.layout.statusPanelOpen ? "toggleButton active" : "toggleButton"}
            title={t("common:layout.statusShortcut")}
            aria-pressed={options.layout.statusPanelOpen}
            onClick={() => togglePanel("status")}
          >
            {t("common:layout.status")}
          </button>
        </div>
        <div className="topBarActions">
          <LanguageSelector value={options.language} onChange={updateLanguage} />
        </div>
      </header>
    );
  }

  function renderRecentItemsSection() {
    const hasItems = recentItems.projects.length > 0 || recentItems.inputDirs.length > 0 || recentItems.outputDirs.length > 0;

    return (
      <section className="setupSection recentItemsSection">
        <div className="sectionTitle">{t("project:recent.title")}</div>
        {!hasItems && <p className="mutedText">{t("project:recent.empty")}</p>}
        {renderRecentGroup("projects", "project:recent.projects", recentItems.projects, (itemPath) => void openRecentProject(itemPath))}
        {renderRecentGroup("inputDirs", "project:recent.inputDirs", recentItems.inputDirs, openRecentInput)}
        {renderRecentGroup("outputDirs", "project:recent.outputDirs", recentItems.outputDirs, openRecentOutput)}
        {hasItems && (
          <div className="recentActions">
            <button type="button" onClick={() => void cleanRecent()}>
              <RotateCcw size={14} />
              {t("project:recent.clean")}
            </button>
            <button type="button" onClick={() => void clearRecent()}>
              <Trash2 size={14} />
              {t("project:recent.clearAll")}
            </button>
          </div>
        )}
      </section>
    );
  }

  function renderRecentGroup(
    kind: GuiRecentItemKind,
    titleKey: string,
    items: GuiRecentItems[GuiRecentItemKind],
    onOpen: (itemPath: string) => void
  ) {
    if (items.length === 0) {
      return null;
    }

    return (
      <div className="recentBox">
        <div className="recentGroupHeader">
          <span className="miniLabel">{t(titleKey)}</span>
          <button type="button" className="compactButton" onClick={() => void clearRecent(kind)}>{t("project:recent.clear")}</button>
        </div>
        {items.map((item) => (
          <button
            type="button"
            key={item.path}
            title={item.exists ? item.path : t("project:recent.missingPath", { path: item.path })}
            className={item.exists ? "recentItem" : "recentItem missingRecentItem"}
            onClick={() => item.exists && onOpen(item.path)}
            disabled={!item.exists}
          >
            <span>{item.path}</span>
            {!item.exists && <span className="badge warningBadge">{t("common:labels.missing")}</span>}
          </button>
        ))}
      </div>
    );
  }

  function renderProjectPanel() {
    return (
      <section className="panel setupPanel" onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
        <div className="panelHeader">
          <h2>{t("project:panel.title")}</h2>
          <button type="button" className="iconButton" title={t("common:actions.newProject")} aria-label={t("common:actions.newProject")} onClick={() => void newProject()}>
            <FilePlus size={17} />
          </button>
        </div>

        <section className="setupSection">
          <div className="sectionTitle">{t("project:panel.project")}</div>
          <div className="projectPathBox">
            <span>{currentProjectPath ?? t("project:projectFile.unsaved")}</span>
          </div>
          <div className="projectButtonGrid">
            <button type="button" onClick={() => void openProject()}>
              <FolderOpen size={17} />
              {t("common:actions.open")}
            </button>
            <button type="button" onClick={() => void saveProject(false)}>
              <Save size={17} />
              {t("common:actions.save")}
            </button>
            <button type="button" title={t("common:actions.saveAs")} onClick={() => void saveProject(true)}>
              <Save size={17} />
              {t("common:actions.saveAsShort")}
            </button>
          </div>
        </section>

        {renderRecentItemsSection()}

        <section className="setupSection">
          <div className="sectionTitle">{t("project:panel.folders")}</div>
          <label className="field">
            <span>{t("project:inputFolder.label")}</span>
            <div className={!options.inputDir.trim() ? "pathControl invalidControl" : "pathControl"}>
              <input
                value={options.inputDir}
                placeholder={t("project:inputFolder.placeholder")}
                onChange={(event) => updateOptions({ inputDir: event.target.value })}
              />
              <button type="button" title={t("project:inputFolder.label")} aria-label={t("project:inputFolder.label")} onClick={chooseInput}>
                <FolderOpen size={17} />
              </button>
            </div>
          </label>
          <label className="field">
            <span>{t("project:outputFolder.label")}</span>
            <div className={!options.outputDir.trim() ? "pathControl invalidControl" : "pathControl"}>
              <input
                value={options.outputDir}
                placeholder={t("project:outputFolder.placeholder")}
                onChange={(event) => updateOptions({ outputDir: event.target.value })}
              />
              <button type="button" title={t("project:outputFolder.label")} aria-label={t("project:outputFolder.label")} onClick={chooseOutput}>
                <FolderOpen size={17} />
              </button>
            </div>
          </label>
        </section>

        <section className="setupSection">
          <div className="sectionTitle">{t("project:panel.basic")}</div>
          <div className="profileBox">
            <label className="field">
              <span>{t("options:profile")}</span>
              <select value={options.profile} onChange={(event) => updateProfile(event.target.value as GuiProfileId)}>
                {PROFILE_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>{t(`project:profile.${preset.id}`)}</option>
                ))}
              </select>
            </label>
            <label className="inlineCheck recommendedCheck">
              <input
                type="checkbox"
                checked={options.useRecommendedSettings}
                onChange={(event) => toggleRecommendedSettings(event.target.checked)}
              />
              {t("project:recommended.use")}
            </label>
            <button type="button" onClick={applyPreset}>
              <Wand2 size={15} />
              {t("project:recommended.apply")}
            </button>
            <p>{t(`project:profileDescription.${options.profile}`, { defaultValue: selectedProfile.description })}</p>
            <p className="recommendedHint">{t(`project:recommended.hint.${options.profile}`)}</p>
            <div className="recommendationSummary">
              {t("project:recommended.summary", {
                algorithm: t(`options:values.${options.algorithm}`),
                sizeMode: t(`options:values.${sizeModeTranslationKey(options.sizeMode)}`),
                trim: options.trim ? t("common:states.on") : t("common:states.off"),
                rotate: options.rotate ? t("common:states.on") : t("common:states.off"),
                cache: options.cache ? t("common:states.on") : t("common:states.off")
              })}
            </div>
          </div>
          <div className="optionsGrid">
            <label className="field">
              <span>{t("project:atlasName.label")}</span>
              <input value={options.name} onChange={(event) => updateOptions({ name: event.target.value })} />
            </label>
            <label className="field">
              <span>{t("options:maxSize")}</span>
              <select value={options.maxSize} onChange={(event) => updateOptions({ maxSize: Number(event.target.value) })}>
                <option value={1024}>1024</option>
                <option value={2048}>2048</option>
                <option value={4096}>4096</option>
                <option value={8192}>8192</option>
              </select>
            </label>
            <label className="field">
              <span>{t("options:padding")}</span>
              <input type="number" min={0} value={options.padding} onChange={(event) => updateOptions({ padding: Number(event.target.value) })} />
            </label>
            <label className="field">
              <span>{t("options:extrude")}</span>
              <input type="number" min={0} value={options.extrude} onChange={(event) => updateOptions({ extrude: Number(event.target.value) })} />
            </label>
          </div>
          <div className="toggleRow">
            <label><input type="checkbox" checked={options.trim} onChange={(event) => updateOptions({ trim: event.target.checked })} /> {t("options:trim")}</label>
            <label><input type="checkbox" checked={options.rotate} onChange={(event) => updateOptions({ rotate: event.target.checked })} /> {t("options:rotate")}</label>
          </div>
        </section>

        <section className="setupSection">
          <button type="button" className="sectionToggle" onClick={() => updateUiSettings({ advancedCollapsed: !options.advancedCollapsed })}>
            {t("project:panel.advanced")}
            <span>{options.advancedCollapsed ? "+" : "-"}</span>
          </button>
          {!options.advancedCollapsed && (
            <>
              <div className="optionsGrid">
                <label className="field">
                  <span>{t("options:algorithm")}</span>
                  <select value={options.algorithm} onChange={(event) => updateOptions({ algorithm: event.target.value as PackingAlgorithm })}>
                    <option value="shelf">{t("options:values.shelf")}</option>
                    <option value="maxrects">{t("options:values.maxrects")}</option>
                  </select>
                </label>
                <label className="field">
                  <span>{t("options:sizeMode")}</span>
                  <select value={options.sizeMode} onChange={(event) => updateOptions({ sizeMode: event.target.value as SizeMode })}>
                    <option value="tight">{t("options:values.tight")}</option>
                    <option value="pot">{t("options:values.pot")}</option>
                    <option value="square-pot">{t("options:values.squarePot")}</option>
                  </select>
                </label>
              </div>
              <div className="toggleRow">
                <label><input type="checkbox" checked={options.clean} onChange={(event) => updateOptions({ clean: event.target.checked })} /> {t("options:clean")}</label>
                <label><input type="checkbox" checked={options.cache} onChange={(event) => updateOptions({ cache: event.target.checked })} /> {t("options:cache")}</label>
                <label><input type="checkbox" checked={options.watch} onChange={(event) => updateOptions({ watch: event.target.checked })} /> {t("options:watch")}</label>
              </div>
            </>
          )}
        </section>

        {!validation.valid && <div className="validationBox">{localizedValidationErrors.join(" ")}</div>}

        <div className="exportBlock">
          <div className={validation.valid ? "exportReason ready" : "exportReason blocked"}>
            {validation.valid ? t("project:export.ready") : t("project:export.blocked")}
          </div>
          <button type="button" className="primaryButton exportButton" disabled={status === "running" || !validation.valid} onClick={() => void runExport()}>
            {status === "running" ? <RotateCcw size={18} className="spinIcon" /> : <Play size={18} />}
            {t("common:actions.export")}
          </button>
          <div className="secondaryActionRow">
            <button type="button" disabled={!options.outputDir.trim()} onClick={() => void openOutput()}>
              <ExternalLink size={17} />
              {t("common:actions.openOutput")}
            </button>
            <button type="button" onClick={() => {
              openRightPanelTab("batch");
            }}>
              <Files size={17} />
              {t("sprites:tabs.batch")}
            </button>
          </div>
        </div>
      </section>
    );
  }

  function renderRightPanel() {
    const visibleCount = editorInputSprites.length > 0 ? filteredInputSprites.length : filteredSprites.length;

    return (
      <section className="panel spritePanel">
        <div className="panelHeader">
          <h2>{t(`sprites:tabs.${options.rightPanelTab}`)}</h2>
          <span>{visibleCount}</span>
        </div>
        <div className="rightTabs" role="tablist">
          {(["list", "selected", "filters", "batch"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={options.rightPanelTab === tab}
              className={options.rightPanelTab === tab ? "tab active" : "tab"}
              onClick={() => updateRightPanelTab(tab)}
            >
              {t(`sprites:tabs.${tab}`)}
            </button>
          ))}
        </div>
        {options.rightPanelTab === "list" && renderSpritesTab()}
        {options.rightPanelTab === "selected" && renderSelectedSpriteTab()}
        {options.rightPanelTab === "filters" && renderFiltersTab()}
        {options.rightPanelTab === "batch" && renderBatchTab()}
      </section>
    );
  }

  function renderRightPanelGuide(messageKey: string, action?: ReactNode) {
    return (
      <div className="rightTabContent compactPanel">
        <div className="metadataEmptyState rightPanelGuide">
          <p>{t(messageKey)}</p>
          {action && <div className="guideActions">{action}</div>}
        </div>
      </div>
    );
  }

  function renderSpritesTab() {
    if (!options.inputDir.trim()) {
      return renderRightPanelGuide("sprites:guide.noInput", (
        <button type="button" className="primaryButton" onClick={chooseInput}>
          <FolderOpen size={15} />
          {t("project:inputFolder.label")}
        </button>
      ));
    }

    if (editorInputSprites.length === 0) {
      return renderRightPanelGuide("sprites:guide.noSprites", (
        <button type="button" className="primaryButton" onClick={() => void scanInputSprites()}>
          <RotateCcw size={15} />
          {t("common:actions.scan")}
        </button>
      ));
    }

    return (
      <div className="rightTabContent">
        <div className="metadataEditorHeader">
          <span>{t("metadata:editor.summary", { scan: scanLabel, missing: missingMetadataCount, selected: selectedEditablePaths.length })}</span>
          <div className="metadataHeaderActions">
            <button type="button" onClick={selectAllVisibleInputSprites} disabled={filteredInputSprites.length === 0}>{t("sprites:list.selectVisible")}</button>
            <button type="button" title={t("common:actions.scan")} onClick={() => void scanInputSprites()}>
              <RotateCcw size={15} />
              {t("common:actions.scan")}
            </button>
          </div>
        </div>
        <input
          className="searchInput inlineSearch"
          placeholder={t("sprites:search")}
          value={spriteQuery}
          aria-label={t("sprites:search")}
          onChange={(event) => setSpriteQuery(event.target.value)}
        />
        <div className="simpleFilterRow">
          <label className="field">
            <span>{t("sprites:filters.include")}</span>
            <select value={inputIncludeFilter} onChange={(event) => setInputIncludeFilter(event.target.value as InputSpriteIncludeFilter)}>
              <option value="all">{t("sprites:filters.all")}</option>
              <option value="included">{t("sprites:filters.included")}</option>
              <option value="excluded">{t("sprites:filters.excluded")}</option>
            </select>
          </label>
          <label className="field">
            <span>{t("sprites:filters.group")}</span>
            <select value={inputGroupFilter} onChange={(event) => setInputGroupFilter(event.target.value)}>
              <option value="">{t("sprites:filters.all")}</option>
              {groupOptions.map((group) => <option key={group} value={group}>{group}</option>)}
            </select>
          </label>
          <label className="field">
            <span>{t("sprites:filters.tag")}</span>
            <select value={inputTagFilter} onChange={(event) => setInputTagFilter(event.target.value)}>
              <option value="">{t("sprites:filters.all")}</option>
              {tagOptions.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
            </select>
          </label>
          <label className="field">
            <span>{t("sprites:filters.trim")}</span>
            <select value={inputTrimFilter} onChange={(event) => setInputTrimFilter(event.target.value as "all" | SpriteTrimMode)}>
              <option value="all">{t("sprites:filters.all")}</option>
              <option value="default">{t("options:values.defaultTrim")}</option>
              <option value="auto">{t("options:values.autoTrim")}</option>
              <option value="none">{t("options:values.noTrim")}</option>
              <option value="manual">{t("options:values.manualCrop")}</option>
            </select>
          </label>
        </div>
        <SpriteMetadataTable
          sprites={filteredInputSprites}
          selectedPath={selectedInputPath}
          selectedPaths={selectedInputPaths}
          onSelect={handleInputSpriteSelect}
          onToggleInclude={toggleInputSpriteInclude}
          onUpdate={updateInputSpriteMetadata}
          onMove={moveSpriteOrder}
          onReorderVisible={reorderVisibleSpriteOrder}
        />
        <div className="exportedSpriteHeader">
          <span>{t("sprites:list.exportedRects")}</span>
          <span>{filteredSprites.length}</span>
        </div>
        <SpriteTable sprites={filteredSprites} selectedName={selectedSpriteName} onSelect={handleSpriteSelect} />
      </div>
    );
  }

  function renderSelectedSpriteTab() {
    if (!selectedInputSprite) {
      return renderRightPanelGuide("sprites:guide.noSelected");
    }

    return (
      <div className="rightTabContent">
        <div className="spriteEditorGrid selectedSpriteEditor">
          <label className="field includeField">
            <span>{t("sprites:selected.include")}</span>
            <input type="checkbox" checked={selectedInputSprite.include} onChange={() => toggleInputSpriteInclude(selectedInputSprite)} />
          </label>
          <label className="field">
            <span>{t("sprites:selected.source")}</span>
            <input value={selectedInputSprite.relativePath} readOnly />
          </label>
          <label className="field">
            <span>{t("sprites:selected.order")}</span>
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
            <span>{t("sprites:selected.nameOverride")}</span>
            <input
              value={selectedInputSprite.nameOverride ?? ""}
              onChange={(event) => updateSelectedSpriteMetadata({ nameOverride: event.target.value })}
              placeholder={selectedInputSprite.originalName}
            />
          </label>
          <label className="field">
            <span>{t("sprites:table.group")}</span>
            <input value={selectedInputSprite.group} onChange={(event) => updateSelectedSpriteMetadata({ group: event.target.value })} />
          </label>
          <label className="field">
            <span>{t("sprites:selected.pivotX")}</span>
            <input type="number" min={0} max={1} step={0.01} value={selectedInputSprite.pivotX} onChange={(event) => updateSelectedSpriteMetadata({ pivotX: Number(event.target.value) })} />
          </label>
          <label className="field">
            <span>{t("sprites:selected.pivotY")}</span>
            <input type="number" min={0} max={1} step={0.01} value={selectedInputSprite.pivotY} onChange={(event) => updateSelectedSpriteMetadata({ pivotY: Number(event.target.value) })} />
          </label>
          <div className="pivotPresetRow">
            <button type="button" onClick={() => setSelectedPivot(0.5, 0.5)}>{t("sprites:selected.center")}</button>
            <button type="button" onClick={() => setSelectedPivot(0.5, 1)}>{t("sprites:selected.bottom")}</button>
            <button type="button" onClick={() => setSelectedPivot(0, 0)}>{t("sprites:selected.topLeft")}</button>
            <button type="button" onClick={() => setSelectedPivot(0.5, 0)}>{t("sprites:selected.top")}</button>
            <button type="button" onClick={() => setSelectedPivot(0, 1)}>{t("sprites:selected.bottomLeft")}</button>
          </div>
          <label className="field tagsField">
            <span>{t("sprites:table.tags")}</span>
            <input
              value={selectedInputSprite.tags.join(", ")}
              onChange={(event) => updateSelectedSpriteMetadata({
                tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean)
              })}
            />
          </label>
          <label className="field">
            <span>{t("sprites:table.trim")}</span>
            <select value={selectedInputSprite.trimMode} onChange={(event) => updateSelectedTrimMode(event.target.value as SpriteTrimMode)}>
              <option value="default">{t("options:values.defaultTrim")}</option>
              <option value="auto">{t("options:values.autoTrim")}</option>
              <option value="none">{t("options:values.noTrim")}</option>
              <option value="manual">{t("options:values.manualCrop")}</option>
            </select>
          </label>
          <div className="cropButtonRow">
            <button type="button" onClick={useFullImageCrop}>{t("metadata:crop.useFullImage")}</button>
            <button type="button" onClick={useCurrentAutoTrimCrop}>{t("metadata:crop.useAutoTrim")}</button>
            <button type="button" onClick={centerSelectedCrop}>{t("metadata:crop.centerCrop")}</button>
            <button type="button" onClick={applySelectedCrop}>{t("metadata:crop.applyCrop")}</button>
            <button type="button" onClick={resetCrop}>{t("metadata:crop.resetCrop")}</button>
            <button type="button" onClick={validateSelectedCrop}>{t("metadata:crop.validateCrop")}</button>
          </div>
          <div className="cropInputGrid">
            <label className="field">
              <span>{t("metadata:crop.cropX")}</span>
              <input type="number" min={0} value={selectedInputSprite.crop?.x ?? ""} onChange={(event) => updateSelectedCrop({ x: Number(event.target.value) })} />
            </label>
            <label className="field">
              <span>{t("metadata:crop.cropY")}</span>
              <input type="number" min={0} value={selectedInputSprite.crop?.y ?? ""} onChange={(event) => updateSelectedCrop({ y: Number(event.target.value) })} />
            </label>
            <label className="field">
              <span>{t("metadata:crop.cropW")}</span>
              <input type="number" min={1} value={selectedInputSprite.crop?.w ?? ""} onChange={(event) => updateSelectedCrop({ w: Number(event.target.value) })} />
            </label>
            <label className="field">
              <span>{t("metadata:crop.cropH")}</span>
              <input type="number" min={1} value={selectedInputSprite.crop?.h ?? ""} onChange={(event) => updateSelectedCrop({ h: Number(event.target.value) })} />
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
      </div>
    );
  }

  function renderFiltersTab() {
    return (
      <div className="rightTabContent filtersTab">
        <input
          className="searchInput inlineSearch"
          placeholder={t("sprites:search")}
          value={spriteQuery}
          aria-label={t("sprites:search")}
          onChange={(event) => setSpriteQuery(event.target.value)}
        />
        <div className="spriteFilterGrid advancedFilters">
          <label className="field">
            <span>{t("sprites:filters.include")}</span>
            <select value={inputIncludeFilter} onChange={(event) => setInputIncludeFilter(event.target.value as InputSpriteIncludeFilter)}>
              <option value="all">{t("sprites:filters.all")}</option>
              <option value="included">{t("sprites:filters.included")}</option>
              <option value="excluded">{t("sprites:filters.excluded")}</option>
            </select>
          </label>
          <label className="field">
            <span>{t("sprites:filters.group")}</span>
            <select value={inputGroupFilter} onChange={(event) => setInputGroupFilter(event.target.value)}>
              <option value="">{t("sprites:filters.all")}</option>
              {groupOptions.map((group) => <option key={group} value={group}>{group}</option>)}
            </select>
          </label>
          <label className="field">
            <span>{t("sprites:filters.tag")}</span>
            <select value={inputTagFilter} onChange={(event) => setInputTagFilter(event.target.value)}>
              <option value="">{t("sprites:filters.all")}</option>
              {tagOptions.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
            </select>
          </label>
          <label className="field">
            <span>{t("sprites:filters.trim")}</span>
            <select value={inputTrimFilter} onChange={(event) => setInputTrimFilter(event.target.value as "all" | SpriteTrimMode)}>
              <option value="all">{t("sprites:filters.all")}</option>
              <option value="default">{t("options:values.defaultTrim")}</option>
              <option value="auto">{t("options:values.autoTrim")}</option>
              <option value="none">{t("options:values.noTrim")}</option>
              <option value="manual">{t("options:values.manualCrop")}</option>
            </select>
          </label>
          <label className="field">
            <span>{t("sprites:filters.sort")}</span>
            <select value={inputSortBy} onChange={(event) => setInputSortBy(event.target.value as InputSpriteSortKey)}>
              <option value="order">{t("sprites:table.order")}</option>
              <option value="source">{t("sprites:table.source")}</option>
              <option value="export">{t("sprites:table.export")}</option>
              <option value="group">{t("sprites:table.group")}</option>
              <option value="include">{t("sprites:filters.include")}</option>
              <option value="trim">{t("sprites:filters.trim")}</option>
              <option value="invalid">{t("sprites:filters.invalidOnly")}</option>
            </select>
          </label>
          <label className="inlineCheck"><input type="checkbox" checked={onlyNameOverrides} onChange={(event) => setOnlyNameOverrides(event.target.checked)} /> {t("sprites:filters.hasOverride")}</label>
          <label className="inlineCheck"><input type="checkbox" checked={onlyWithCrop} onChange={(event) => setOnlyWithCrop(event.target.checked)} /> {t("sprites:filters.hasCrop")}</label>
          <label className="inlineCheck"><input type="checkbox" checked={invalidOnly} onChange={(event) => setInvalidOnly(event.target.checked)} /> {t("sprites:filters.invalidOnly")}</label>
          <label className="inlineCheck"><input type="checkbox" checked={missingOnly} onChange={(event) => setMissingOnly(event.target.checked)} /> {t("sprites:filters.missingOnly")}</label>
          <button type="button" className="compactButton" onClick={resetInputFilters}>{t("sprites:filters.reset")}</button>
        </div>
      </div>
    );
  }

  function renderBatchTab() {
    return (
      <div className="rightTabContent">
        <div className="batchSetEditor">
          <div className="metadataEditorHeader">
            <span>{t("batch:set.title")}</span>
            <div className="metadataHeaderActions">
              <button type="button" onClick={() => void openBatchSet()}>
                <FolderOpen size={15} />
                {t("batch:set.open")}
              </button>
              <button type="button" onClick={() => void saveBatchSet(false)}>
                <Save size={15} />
                {t("batch:set.save")}
              </button>
              <button type="button" onClick={() => void runCurrentBatchSet()} disabled={batchSetProjects.length === 0 || status === "running"}>
                <Play size={15} />
                {t("batch:set.runNow")}
              </button>
            </div>
          </div>
          <label className="field">
            <span>{t("batch:set.name")}</span>
            <input value={batchSetName} onChange={(event) => setBatchSetName(event.target.value)} />
          </label>
          <div className="batchSetPath" title={currentBatchSetPath ?? ""}>
            {currentBatchSetPath ?? t("batch:set.unsaved")}
          </div>
          <div className="batchProjectList">
            <div className="miniLabel">{t("batch:set.projectList")}</div>
            {batchSetProjects.length > 0 ? batchSetProjects.map((projectPath) => (
              <div key={projectPath} className="batchProjectRow" title={projectPath}>
                <span>{projectPath}</span>
                <button type="button" title={t("batch:set.removeProject")} onClick={() => removeBatchSetProject(projectPath)}>
                  <X size={14} />
                </button>
              </div>
            )) : (
              <p className="mutedText">{t("batch:set.noProjects")}</p>
            )}
          </div>
          <label className="field">
            <span>{t("batch:set.projects")}</span>
            <textarea
              value={batchSetProjectsText}
              onChange={(event) => setBatchSetProjectsText(event.target.value)}
              spellCheck={false}
            />
          </label>
          <div className="batchSetActions">
            <button type="button" onClick={() => void addBatchSetProjects()}>
              <Files size={15} />
              {t("batch:set.addProject")}
            </button>
            <button type="button" onClick={() => void chooseBatchSetProjects()}>
              <Files size={15} />
              {t("batch:set.replaceProjects")}
            </button>
            <button type="button" onClick={() => void saveBatchSet(true)}>
              <Save size={15} />
              {t("common:actions.saveAs")}
            </button>
          </div>
          <div className="batchSetOptions">
            <label className="inlineCheck">
              <input type="checkbox" checked={batchSetFailFast} onChange={(event) => setBatchSetFailFast(event.target.checked)} />
              {t("batch:set.failFast")}
            </label>
            <label className="inlineCheck">
              <input type="checkbox" checked={false} readOnly disabled />
              {t("batch:set.scheduleUnsupported")}
            </label>
          </div>
        </div>

        <div className="metadataEditor">
          <div className="metadataEditorHeader">
            <span>{t("sprites:bulk.title")}</span>
            <div className="metadataHeaderActions">
              <button type="button" onClick={() => void runBatchExport()}>{t("common:actions.batchExport")}</button>
              <button type="button" onClick={cleanupMissingMetadata} disabled={missingMetadataCount === 0}>{t("common:actions.cleanup")}</button>
            </div>
          </div>
          <div className="bulkActionRow">
            <button type="button" onClick={includeAll} disabled={inputSprites.length === 0}>{t("sprites:bulk.includeAll")}</button>
            <button type="button" onClick={includeSelected} disabled={selectedEditablePaths.length === 0}>{t("sprites:bulk.includeSelected")}</button>
            <button type="button" onClick={excludeSelected} disabled={selectedEditablePaths.length === 0}>{t("sprites:bulk.excludeSelected")}</button>
            <button type="button" onClick={resetSelectedMetadata} disabled={selectedEditablePaths.length === 0}>
              <Eraser size={15} />
              {t("common:actions.reset")}
            </button>
            <button type="button" onClick={clearOverrides}>{t("sprites:bulk.clearNames")}</button>
            <button type="button" onClick={clearGroups}>{t("sprites:bulk.clearTags")}</button>
            <button type="button" onClick={() => moveSelectedOrder("top")} disabled={!selectedInputSprite}>{t("common:actions.top")}</button>
            <button type="button" onClick={() => moveSelectedOrder("up")} disabled={!selectedInputSprite}>{t("common:actions.up")}</button>
            <button type="button" onClick={() => moveSelectedOrder("down")} disabled={!selectedInputSprite}>{t("common:actions.down")}</button>
            <button type="button" onClick={() => moveSelectedOrder("bottom")} disabled={!selectedInputSprite}>{t("common:actions.bottom")}</button>
            <button type="button" onClick={assignSequentialOrderToSelected} disabled={selectedEditablePaths.length === 0}>{t("sprites:bulk.sequentialOrder")}</button>
            <button type="button" onClick={clearOrderForSelected} disabled={selectedEditablePaths.length === 0}>{t("sprites:bulk.clearOrder")}</button>
            <button type="button" onClick={resetOrder}>{t("sprites:bulk.resetOrder")}</button>
            <button type="button" onClick={resetCropForSelected} disabled={selectedEditablePaths.length === 0}>{t("sprites:bulk.resetCrop")}</button>
            <button type="button" onClick={resetPivotForSelected} disabled={selectedEditablePaths.length === 0}>{t("sprites:bulk.resetPivot")}</button>
          </div>
          <div className="bulkEditRow">
            <input value={bulkGroup} placeholder={t("sprites:bulk.groupPlaceholder")} onChange={(event) => setBulkGroup(event.target.value)} />
            <button type="button" onClick={applyGroupToSelected} disabled={selectedEditablePaths.length === 0}>{t("sprites:bulk.setGroup")}</button>
            <input value={bulkTags} placeholder={t("sprites:bulk.tagsPlaceholder")} onChange={(event) => setBulkTags(event.target.value)} />
            <button type="button" onClick={addTagsToSelected} disabled={selectedEditablePaths.length === 0}>{t("sprites:bulk.addTags")}</button>
            <button type="button" onClick={removeTagsFromSelected} disabled={selectedEditablePaths.length === 0}>{t("sprites:bulk.removeTags")}</button>
            <select value={bulkTrimMode} onChange={(event) => setBulkTrimMode(event.target.value as SpriteTrimMode)}>
              <option value="default">{t("options:values.defaultTrim")}</option>
              <option value="auto">{t("options:values.autoTrim")}</option>
              <option value="none">{t("options:values.noTrim")}</option>
              <option value="manual">{t("options:values.manualCrop")}</option>
            </select>
            <button type="button" onClick={applyTrimModeToSelected} disabled={selectedEditablePaths.length === 0}>{t("sprites:bulk.setTrim")}</button>
          </div>
        </div>

        <div className="batchBox">
          <div className="miniLabel">{t("batch:results")}</div>
          {batchResult ? (
            <>
              <strong>{t("batch:summary", { succeeded: batchResult.succeeded, total: batchResult.total })}</strong>
              {batchResult.results.map((item) => (
                <div key={item.projectPath} className={item.success ? "batchItem ok" : "batchItem fail"} title={item.projectPath}>
                  <span>{item.success ? t("common:states.ok") : t("common:states.fail")}</span>
                  <p>{item.projectPath}</p>
                </div>
              ))}
            </>
          ) : (
            <p>{t("batch:empty")}</p>
          )}
        </div>
      </div>
    );
  }

  function renderExportResultCard() {
    if (!result || !exportResultSummary) {
      return null;
    }

    return (
      <div className="exportResultCard">
        <div className="exportResultHeader">
          <CheckCircle2 size={18} />
          <div>
            <h3>{t("diagnostics:resultCard.title")}</h3>
            <p>{t("diagnostics:resultCard.subtitle", { name: options.name })}</p>
          </div>
        </div>
        <div className="resultMetricGrid">
          <button type="button" className="resultMetric" onClick={() => openRightPanelTab("list")}>
            <span>{t("diagnostics:labels.sprites")}</span>
            <strong>{exportResultSummary.spriteCount}</strong>
          </button>
          <div className="resultMetric">
            <span>{t("diagnostics:labels.pages")}</span>
            <strong>{exportResultSummary.pageCount}</strong>
          </div>
          <div className="resultMetric">
            <span>{t("diagnostics:resultCard.elapsed")}</span>
            <strong>{exportResultSummary.elapsed}</strong>
          </div>
        </div>
        {exportValidationDisplay && (
          <div className={`validationSummary ${exportValidationDisplay.tone}`}>
            <div>
              {exportValidationDisplay.tone === "passed" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              <strong>{t(exportValidationDisplay.titleKey)}</strong>
            </div>
            <p>{t(exportValidationDisplay.messageKey)}</p>
            {result.validation.issues.length > 0 && (
              <ul>
                {result.validation.issues.map((issue) => (
                  <li key={`${issue.code}-${issue.message}`}>
                    {t(`diagnostics:validation.issues.${issue.code}`, { defaultValue: issue.message })}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <dl className="resultDetails">
          <div>
            <dt>{t("project:outputFolder.label")}</dt>
            <dd title={result.outputDir}>{result.outputDir}</dd>
          </div>
          <div>
            <dt>{t("options:profile")}</dt>
            <dd>{t(`project:profile.${options.profile}`)}</dd>
          </div>
          <div>
            <dt>{t("diagnostics:labels.algorithm")}</dt>
            <dd>{t(`options:values.${options.algorithm}`)}</dd>
          </div>
          <div>
            <dt>{t("diagnostics:labels.size")}</dt>
            <dd>{t(`options:values.${sizeModeTranslationKey(options.sizeMode)}`)}</dd>
          </div>
        </dl>
        <div className="resultFiles">
          <span className="miniLabel">{t("diagnostics:resultCard.files")}</span>
          {exportResultSummary.outputFiles.map((filePath) => (
            <span key={filePath} title={filePath}>{filePath}</span>
          ))}
        </div>
        <div className="resultActions">
          <button type="button" className="highlightButton" onClick={() => void openOutput(result.outputDir)} disabled={!result.outputDir.trim()}>
            <ExternalLink size={15} />
            {t("diagnostics:resultCard.openOutput")}
          </button>
          <button type="button" onClick={showExportJson} disabled={!atlasJson}>
            <FileJson size={15} />
            {t("diagnostics:resultCard.viewJson")}
          </button>
          <button type="button" onClick={showExportLog} disabled={!logText}>
            <FileText size={15} />
            {t("diagnostics:resultCard.viewLog")}
          </button>
          <button type="button" className="primaryButton" onClick={() => void runExport()} disabled={status === "running" || !validation.valid}>
            <Play size={15} />
            {t("diagnostics:resultCard.exportAgain")}
          </button>
        </div>
      </div>
    );
  }

  function showExportJson() {
    if (!atlasJson) {
      return;
    }

    setLogText(JSON.stringify(atlasJson, null, 2));
    updateLayout({ statusPanelOpen: true });
  }

  function showExportLog() {
    if (!result) {
      return;
    }

    void window.suwolAtlas.readLog(result.logPath).then((text) => {
      setLogText(text);
      updateLayout({ statusPanelOpen: true });
    }).catch(showError);
  }

  function renderStatusPanel() {
    return (
      <section className={options.layout.statusPanelOpen ? `panel statusPanel ${status}` : `panel statusPanel compact ${status}`}>
        <div className="statusBarSummary">
          <h2>{t("diagnostics:title")}</h2>
          <div className="statusTextLine">
            <span className={`statusDot ${status}`} />
            <span title={statusSummary}>{statusSummary}</span>
          </div>
          <div className="statusActions">
            <button
              type="button"
              className="ghostButton"
              title={options.layout.statusPanelOpen ? t("diagnostics:hide") : t("diagnostics:details")}
              onClick={() => togglePanel("status")}
            >
              {options.layout.statusPanelOpen ? t("diagnostics:hide") : t("diagnostics:details")}
            </button>
          </div>
        </div>
        {options.layout.statusPanelOpen && (
          <>
            {renderExportResultCard()}
            {renderErrorGuide()}
            {renderUpdateCard()}
            <pre>{logText || t("diagnostics:noIssues")}</pre>
          </>
        )}
      </section>
    );
  }

  function renderUpdateCard() {
    const isBusy = updateStatus.state === "checking" || updateStatus.state === "downloading";
    const canDownload = updateStatus.state === "available";
    const canInstall = updateStatus.state === "downloaded";
    const progressPercent = updateStatus.progress ? Math.round(updateStatus.progress.percent) : 0;

    return (
      <div className={`updateCard ${updateStatus.state}`}>
        <div className="updateCardHeader">
          <div>
            <RotateCcw size={16} />
            <strong>{t("updates:title")}</strong>
          </div>
          <span>{getLinuxUpdateMessage(updateStatus)}</span>
        </div>
        <p>{updateStatus.supported ? t("updates:stableOnly") : t("updates:linuxOnly")}</p>
        {updateStatus.currentVersion && (
          <div className="updateMeta">{t("updates:currentVersion", { version: updateStatus.currentVersion })}</div>
        )}
        {updateStatus.reason && (
          <div className="updateMeta">{t(`updates:reason.${updateStatus.reason}`)}</div>
        )}
        {updateStatus.state === "downloading" && (
          <div className="updateProgress" aria-label={t("updates:downloading")}>
            <span style={{ width: `${progressPercent}%` }} />
          </div>
        )}
        <div className="updateOptions">
          <label>
            <input
              type="checkbox"
              checked={options.updates.linuxEnabled}
              onChange={(event) => void setLinuxUpdatesEnabled(event.target.checked)}
            />
            {t("updates:enabled")}
          </label>
          <label>
            <input
              type="checkbox"
              checked={options.updates.linuxAutoCheck}
              onChange={(event) => setLinuxAutoCheck(event.target.checked)}
            />
            {t("updates:autoCheck")}
          </label>
        </div>
        <div className="updateActions">
          <button type="button" onClick={() => void checkLinuxUpdates(true)} disabled={isBusy || !options.updates.linuxEnabled}>
            <RotateCcw size={14} />
            {t("updates:check")}
          </button>
          <button type="button" onClick={() => void downloadLinuxUpdate()} disabled={!canDownload || isBusy}>
            <Play size={14} />
            {t("updates:download")}
          </button>
          <button type="button" className="primaryButton" onClick={() => void installLinuxUpdate()} disabled={!canInstall}>
            <RotateCcw size={14} />
            {t("updates:restart")}
          </button>
          <button type="button" className="ghostButton" onClick={() => setStatusText(t("diagnostics:status.ready"))}>
            {t("updates:later")}
          </button>
        </div>
      </div>
    );
  }

  function renderErrorGuide() {
    if (!currentErrorGuide) {
      return null;
    }

    return (
      <div className="errorGuideCard">
        <div className="errorGuideHeader">
          <AlertTriangle size={16} />
          <strong>{currentErrorGuide.message}</strong>
        </div>
        <div className="miniLabel">{t("errors:guide.title")}</div>
        <ul>
          {currentErrorGuide.actions.map((action) => (
            <li key={action}>{action}</li>
          ))}
        </ul>
      </div>
    );
  }

  function renderHelpDialog() {
    if (!helpOpen) {
      return null;
    }

    return (
      <div className="modalBackdrop" role="presentation" onMouseDown={() => setHelpOpen(false)}>
        <section className="helpDialog" role="dialog" aria-modal="true" aria-label={t("help:title")} onMouseDown={(event) => event.stopPropagation()}>
          <header>
            <div>
              <HelpCircle size={18} />
              <h2>{t("help:title")}</h2>
            </div>
            <button type="button" className="iconButton" title={t("help:close")} aria-label={t("help:close")} onClick={() => setHelpOpen(false)}>
              <X size={17} />
            </button>
          </header>
          <div className="helpTabs" role="tablist">
            {HELP_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={helpTab === tab}
                className={helpTab === tab ? "active" : ""}
                onClick={() => setHelpTab(tab)}
              >
                {t(`help:tabs.${tab}`)}
              </button>
            ))}
          </div>
          <div className="helpBody">
            <h3>{t(`help:sections.${helpTab}.title`)}</h3>
            <ol>
              {HELP_ITEM_KEYS[helpTab].map((key) => (
                <li key={key}>{t(`help:sections.${helpTab}.items.${key}`)}</li>
              ))}
            </ol>
          </div>
        </section>
      </div>
    );
  }

  function renderSplitHandle(kind: SplitterKind) {
    const label = kind === "left"
      ? t("common:layout.resetLeft")
      : kind === "right"
        ? t("common:layout.resetRight")
        : t("common:layout.resetStatus");

    return (
      <div
        role="separator"
        aria-orientation={kind === "bottom" ? "horizontal" : "vertical"}
        tabIndex={0}
        title={label}
        className={`splitHandle ${kind === "bottom" ? "splitHandleHorizontal bottomSplitHandle" : "splitHandleVertical"} ${kind === "left" ? "leftSplitHandle" : kind === "right" ? "rightSplitHandle" : ""}`}
        onPointerDown={(event) => beginLayoutResize(kind, event)}
        onDoubleClick={() => resetLayoutSize(kind)}
      />
    );
  }

  return (
    <div className="appShell" data-language={activeLanguage}>
      {renderTopBar()}
      <main className="workspace" style={workspaceStyle}>
        {options.layout.leftPanelOpen && renderProjectPanel()}
        {options.layout.leftPanelOpen && renderSplitHandle("left")}
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
          emptyReason={previewEmptyReason}
          onSelectInput={chooseInput}
          onSelectOutput={chooseOutput}
          onOpenSample={() => void openSampleProject()}
          onExport={() => void runExport()}
          canExport={validation.valid && status !== "running"}
          onPivotChange={updatePreviewPivot}
        />
        {options.layout.rightPanelOpen && renderSplitHandle("right")}
        {options.layout.rightPanelOpen && renderRightPanel()}
        {options.layout.statusPanelOpen && renderSplitHandle("bottom")}
        {renderStatusPanel()}
      </main>
      {renderHelpDialog()}
    </div>
  );
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

function localizeValidationErrors(errors: string[], t: Translate): string[] {
  return errors.map((error) => {
    if (error === "Input folder is required.") {
      return t("errors:friendly.inputRequired");
    }

    if (error === "Output folder is required.") {
      return t("errors:friendly.outputRequired");
    }

    if (error === "Atlas name is required.") {
      return t("errors:friendly.nameRequired");
    }

    return error;
  });
}

function localizeFriendlyError(message: string, t: Translate): string {
  const friendly = classifyGuiError(message);

  if (friendly.code === "fallback") {
    return friendly.detail;
  }

  return t(`errors:friendly.${friendly.code}`);
}

function localizeStatusText(statusText: string, t: Translate): string {
  const known: Record<string, string> = {
    "Ready": "diagnostics:status.ready",
    "Exporting...": "diagnostics:status.exporting",
    "Exporting atlas...": "diagnostics:status.exporting",
    "Running batch export...": "diagnostics:status.batchRunning",
    "New project ready.": "diagnostics:status.newProject",
    "Undo.": "diagnostics:status.undo",
    "Redo.": "diagnostics:status.redo"
  };

  return known[statusText] ? t(known[statusText]) : statusText;
}

function localizeScanText(scanText: string, t: Translate): string {
  if (scanText === "No input scan yet.") {
    return t("diagnostics:scan.none");
  }

  if (scanText === "No input folder selected.") {
    return t("diagnostics:scan.noInput");
  }

  if (scanText === "Scan input folder to edit sprite metadata.") {
    return t("metadata:editor.scanPrompt");
  }

  const match = /^(\d+) PNG sprite\(s\) scanned\.$/.exec(scanText);
  return match ? t("diagnostics:scan.result", { count: Number(match[1]) }) : scanText;
}

function localizeWatchText(watchText: string, t: Translate): string {
  if (watchText === "Off") {
    return t("watch:off");
  }

  if (watchText === "Starting...") {
    return t("watch:starting");
  }

  if (watchText === "Waiting for valid options") {
    return t("watch:waiting");
  }

  return watchText;
}

function preserveUiSettings(next: GuiSettings, current: GuiSettings): GuiSettings {
  return normalizeGuiSettings({
    ...next,
    language: current.language,
    updates: current.updates,
    layout: current.layout,
    advancedCollapsed: current.layout.advancedCollapsed,
    logCollapsed: !current.layout.statusPanelOpen,
    rightPanelTab: current.layout.rightPanelTab
  });
}

function fullImageCrop(sprite: GuiInputSpriteScanItem): SpriteCropRect {
  return {
    x: 0,
    y: 0,
    w: sprite.sourceW,
    h: sprite.sourceH
  };
}

function sizeModeTranslationKey(sizeMode: SizeMode): "tight" | "pot" | "squarePot" {
  return sizeMode === "square-pot" ? "squarePot" : sizeMode;
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
  const { t } = useTranslation(["metadata", "preview"]);
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
        <span>{sprite.trimMode === "manual" ? t("metadata:crop.manual") : t("metadata:crop.preview", { mode: sprite.trimMode })}</span>
        <span>{valid ? t("metadata:crop.ok") : t("metadata:crop.invalid")}</span>
      </div>
      <div className="sourcePreviewToolbar">
        <button type="button" onClick={() => onCropCommit(draftCrop)} disabled={!canEdit}>{t("metadata:crop.applyCrop")}</button>
        <button type="button" onClick={cancelDraft} disabled={!canEdit}>{t("metadata:crop.cancelCropEdit")}</button>
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
              title={t("preview:markers.dragCrop")}
            />
            {(["nw", "ne", "sw", "se", "n", "s", "e", "w"] as CropResizeHandle[]).map((handle) => (
              <div
                key={handle}
                className={`cropHandle ${handle}`}
                style={cropHandleStyle(handle, draftCrop, sourceW, sourceH)}
                data-crop-role="resize"
                data-handle={handle}
                title={t("preview:markers.resize", { handle })}
              />
            ))}
            <div
              className="sourcePivotMarker"
              style={pivotStyle}
              data-crop-role="pivot"
              title={t("preview:markers.dragPivot")}
            />
          </div>
        ) : (
          <div className="emptyState">{error || t("metadata:crop.loading")}</div>
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
