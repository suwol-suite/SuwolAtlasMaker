import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import type {
  GuiExportOptions,
  GuiExportResult,
  GuiBatchExportOptions,
  GuiBatchExportResult,
  GuiBatchSetLoadResult,
  GuiBatchSetRunRequest,
  GuiBatchSetSaveRequest,
  GuiBatchSetSaveResult,
  GuiWatchEvent,
  GuiProjectFile,
  GuiProjectLoadResult,
  GuiProjectSaveRequest,
  GuiProjectSaveResult,
  GuiSourcePreviewRequest,
  GuiSettings,
  AppLanguage,
  SuwolAtlasGuiApi
} from "../shared/gui-types.js";

const api: SuwolAtlasGuiApi = {
  selectInputDirectory: () => ipcRenderer.invoke("dialog:selectInputDirectory"),
  selectOutputDirectory: () => ipcRenderer.invoke("dialog:selectOutputDirectory"),
  exportAtlas: (options: GuiExportOptions): Promise<GuiExportResult> => ipcRenderer.invoke("atlas:export", options),
  scanInput: (options: GuiExportOptions) => ipcRenderer.invoke("atlas:scanInput", options),
  getSourceImagePreview: (request: GuiSourcePreviewRequest) => ipcRenderer.invoke("atlas:getSourceImagePreview", request),
  computeAutoTrimRect: (request: GuiSourcePreviewRequest) => ipcRenderer.invoke("atlas:computeAutoTrimRect", request),
  validateSpriteCrop: (request) => ipcRenderer.invoke("atlas:validateSpriteCrop", request),
  readJson: (path: string) => ipcRenderer.invoke("atlas:readJson", path),
  readLog: (path: string) => ipcRenderer.invoke("atlas:readLog", path),
  openOutputDirectory: (path: string) => ipcRenderer.invoke("atlas:openOutputDirectory", path),
  selectBatchTargets: (): Promise<string[] | null> => ipcRenderer.invoke("batch:selectTargets"),
  runBatchExport: (paths: string[], options?: GuiBatchExportOptions): Promise<GuiBatchExportResult> =>
    ipcRenderer.invoke("batch:export", paths, options),
  openBatchSetDialog: (): Promise<GuiBatchSetLoadResult | null> => ipcRenderer.invoke("batchSet:openDialog"),
  saveBatchSet: (request: GuiBatchSetSaveRequest): Promise<GuiBatchSetSaveResult> =>
    ipcRenderer.invoke("batchSet:save", request),
  saveBatchSetAs: (request: GuiBatchSetSaveRequest): Promise<GuiBatchSetSaveResult | null> =>
    ipcRenderer.invoke("batchSet:saveAs", request),
  runBatchSet: (request: GuiBatchSetRunRequest): Promise<GuiBatchExportResult> =>
    ipcRenderer.invoke("batchSet:run", request),
  startWatch: (options: GuiExportOptions): Promise<void> => ipcRenderer.invoke("watch:start", options),
  stopWatch: (): Promise<void> => ipcRenderer.invoke("watch:stop"),
  loadSettings: () => ipcRenderer.invoke("settings:load"),
  saveSettings: (settings: GuiSettings) => ipcRenderer.invoke("settings:save", settings),
  newProject: (): Promise<GuiProjectFile> => ipcRenderer.invoke("project:new"),
  openProjectDialog: (): Promise<GuiProjectLoadResult | null> => ipcRenderer.invoke("project:openDialog"),
  saveProject: (request: GuiProjectSaveRequest): Promise<GuiProjectSaveResult> => ipcRenderer.invoke("project:save", request),
  saveProjectAs: (request: GuiProjectSaveRequest): Promise<GuiProjectSaveResult | null> => ipcRenderer.invoke("project:saveAs", request),
  loadProjectFromPath: (path: string): Promise<GuiProjectLoadResult> => ipcRenderer.invoke("project:loadFromPath", path),
  listRecentProjects: (): Promise<string[]> => ipcRenderer.invoke("recent:list"),
  openRecentProject: (path: string): Promise<GuiProjectLoadResult> => ipcRenderer.invoke("recent:open", path),
  getVersion: (): Promise<string> => ipcRenderer.invoke("app:getVersion"),
  getLanguage: (): Promise<AppLanguage> => ipcRenderer.invoke("app:getLanguage"),
  setLanguage: (language: AppLanguage): Promise<void> => ipcRenderer.invoke("app:setLanguage", language),
  rebuildMenu: (): Promise<void> => ipcRenderer.invoke("app:rebuildMenu"),
  onMenuCommand: (callback: (command: string) => void) => {
    const listener = (_event: IpcRendererEvent, command: string) => callback(command);
    ipcRenderer.on("menu:command", listener);
    return () => ipcRenderer.removeListener("menu:command", listener);
  },
  onWatchEvent: (callback: (event: GuiWatchEvent) => void) => {
    const listener = (_event: IpcRendererEvent, event: GuiWatchEvent) => callback(event);
    ipcRenderer.on("watch:event", listener);
    return () => ipcRenderer.removeListener("watch:event", listener);
  }
};

contextBridge.exposeInMainWorld("suwolAtlas", api);
