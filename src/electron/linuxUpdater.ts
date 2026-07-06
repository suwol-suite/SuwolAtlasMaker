import { createRequire } from "node:module";
import { app, ipcMain, type BrowserWindow } from "electron";
import type {
  GuiSettings,
  LinuxUpdateProgress,
  LinuxUpdateStatus,
  LinuxUpdateUnsupportedReason
} from "../shared/gui-types.js";

const require = createRequire(import.meta.url);

const GITHUB_OWNER = "suwol-suite";
const GITHUB_REPO = "SuwolAtlasMaker";
const RELEASE_FEED = `github:${GITHUB_OWNER}/${GITHUB_REPO}`;

export interface LinuxUpdaterGateInput {
  platform: NodeJS.Platform;
  isPackaged: boolean;
  appImage?: string;
  linuxEnabled: boolean;
}

export interface LinuxUpdaterGate {
  supported: boolean;
  reason?: LinuxUpdateUnsupportedReason;
}

export interface LinuxUpdaterOptions {
  getMainWindow(): BrowserWindow | null;
  getSettings(): Promise<GuiSettings>;
  setSettings(settings: GuiSettings): Promise<void>;
  getVersion(): Promise<string>;
  loadAutoUpdater?: () => AutoUpdaterLike;
}

interface UpdateInfoLike {
  version?: string;
}

interface ProgressInfoLike {
  percent?: number;
  transferred?: number;
  total?: number;
  bytesPerSecond?: number;
}

interface AutoUpdaterLike {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  allowPrerelease: boolean;
  checkForUpdates(): Promise<unknown>;
  downloadUpdate(): Promise<unknown>;
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void;
  setFeedURL(options: { provider: "github"; owner: string; repo: string }): void;
  on(event: "checking-for-update", listener: () => void): unknown;
  on(event: "update-available" | "update-not-available" | "update-downloaded", listener: (info: UpdateInfoLike) => void): unknown;
  on(event: "download-progress", listener: (progress: ProgressInfoLike) => void): unknown;
  on(event: "error", listener: (error: unknown) => void): unknown;
}

interface ElectronUpdaterModuleLike {
  autoUpdater?: AutoUpdaterLike;
  default?: {
    autoUpdater?: AutoUpdaterLike;
  };
}

export function resolveLinuxUpdaterGate(input: LinuxUpdaterGateInput): LinuxUpdaterGate {
  if (input.platform !== "linux") {
    return { supported: false, reason: "not-linux" };
  }

  if (!input.isPackaged) {
    return { supported: false, reason: "not-packaged" };
  }

  if (!input.appImage) {
    return { supported: false, reason: "not-appimage" };
  }

  if (!input.linuxEnabled) {
    return { supported: false, reason: "disabled-by-settings" };
  }

  return { supported: true };
}

export function shouldLoadAutoUpdater(input: LinuxUpdaterGateInput): boolean {
  return resolveLinuxUpdaterGate(input).supported;
}

export function createLinuxUpdater(options: LinuxUpdaterOptions) {
  let listenersRegistered = false;
  let autoUpdater: AutoUpdaterLike | undefined;
  let state: LinuxUpdateStatus = {
    state: "idle",
    supported: false
  };

  async function getState(): Promise<LinuxUpdateStatus> {
    const settings = await options.getSettings();
    const gate = resolveLinuxUpdaterGate({
      platform: process.platform,
      isPackaged: app.isPackaged,
      appImage: process.env.APPIMAGE,
      linuxEnabled: settings.updates.linuxEnabled
    });
    const currentVersion = await options.getVersion();

    if (!gate.supported) {
      state = {
        state: "unsupported",
        supported: false,
        reason: gate.reason,
        currentVersion,
        lastCheckedAt: settings.updates.lastCheckedAt
      };
      return state;
    }

    if (state.state === "unsupported") {
      state = { state: "idle", supported: true };
    }

    state = {
      ...state,
      supported: true,
      currentVersion,
      lastCheckedAt: settings.updates.lastCheckedAt
    };

    return state;
  }

  async function checkForUpdates(): Promise<LinuxUpdateStatus> {
    const gateStatus = await getState();

    if (!gateStatus.supported) {
      emitState(gateStatus);
      return gateStatus;
    }

    setState({ state: "checking", error: undefined, technicalDetail: undefined, progress: undefined });

    try {
      const updater = getAutoUpdater();
      registerUpdaterListeners(updater);
      configureUpdater(updater);
      await updater.checkForUpdates();
      await markChecked();
    } catch (error) {
      setError(error);
    }

    return getState();
  }

  async function downloadUpdate(): Promise<LinuxUpdateStatus> {
    const gateStatus = await getState();

    if (!gateStatus.supported) {
      emitState(gateStatus);
      return gateStatus;
    }

    setState({ state: "downloading", progress: undefined });

    try {
      const updater = getAutoUpdater();
      registerUpdaterListeners(updater);
      configureUpdater(updater);
      await updater.downloadUpdate();
    } catch (error) {
      setError(error);
    }

    return getState();
  }

  async function installUpdate(): Promise<void> {
    const current = await getState();

    if (current.state !== "downloaded") {
      return;
    }

    try {
      getAutoUpdater().quitAndInstall(false, true);
    } catch (error) {
      setError(error);
    }
  }

  async function setEnabled(enabled: boolean): Promise<LinuxUpdateStatus> {
    const settings = await options.getSettings();

    await options.setSettings({
      ...settings,
      updates: {
        ...settings.updates,
        linuxEnabled: enabled
      }
    });

    const next = await getState();
    emitState(next);
    return next;
  }

  function getAutoUpdater(): AutoUpdaterLike {
    autoUpdater ??= options.loadAutoUpdater?.() ?? loadAutoUpdater();
    return autoUpdater;
  }

  function registerUpdaterListeners(updater: AutoUpdaterLike): void {
    if (listenersRegistered) {
      return;
    }

    listenersRegistered = true;
    updater.on("checking-for-update", () => setState({ state: "checking", progress: undefined }));
    updater.on("update-available", (info: UpdateInfoLike) => setState({
      state: "available",
      availableVersion: info.version,
      progress: undefined
    }));
    updater.on("update-not-available", (info: UpdateInfoLike) => {
      void markChecked();
      setState({
        state: "not-available",
        availableVersion: info.version,
        progress: undefined
      });
    });
    updater.on("download-progress", (progress: ProgressInfoLike) => {
      const normalized = normalizeProgress(progress);

      setState({
        state: "downloading",
        progress: normalized
      });
      emitProgress(normalized);
    });
    updater.on("update-downloaded", (info: UpdateInfoLike) => setState({
      state: "downloaded",
      downloadedVersion: info.version,
      progress: undefined
    }));
    updater.on("error", (error) => setError(error));
  }

  function configureUpdater(updater: AutoUpdaterLike): void {
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = false;
    updater.allowPrerelease = false;
    updater.setFeedURL({
      provider: "github",
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO
    });
  }

  function setState(patch: Partial<LinuxUpdateStatus>): void {
    state = {
      ...state,
      ...patch,
      supported: patch.supported ?? state.supported
    };
    emitState(state);
  }

  function setError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    const technicalDetail = [
      `message=${message}`,
      `provider=${RELEASE_FEED}`,
      `currentVersion=${state.currentVersion ?? app.getVersion()}`,
      `platform=${process.platform}`,
      `appImage=${process.env.APPIMAGE ? "yes" : "no"}`
    ].join("\n");

    state = {
      ...state,
      state: "error",
      error: message,
      technicalDetail,
      progress: undefined
    };
    emitState(state);
    emitError(state);
  }

  async function markChecked(): Promise<void> {
    const settings = await options.getSettings();
    const lastCheckedAt = new Date().toISOString();

    await options.setSettings({
      ...settings,
      updates: {
        ...settings.updates,
        lastCheckedAt
      }
    });
    state = {
      ...state,
      lastCheckedAt
    };
  }

  function emitState(status: LinuxUpdateStatus): void {
    options.getMainWindow()?.webContents.send("updates:state", status);
  }

  function emitProgress(progress: LinuxUpdateProgress): void {
    options.getMainWindow()?.webContents.send("updates:progress", progress);
  }

  function emitError(status: LinuxUpdateStatus): void {
    options.getMainWindow()?.webContents.send("updates:error", status);
  }

  ipcMain.handle("updates:getState", async () => getState());
  ipcMain.handle("updates:check", async () => checkForUpdates());
  ipcMain.handle("updates:download", async () => downloadUpdate());
  ipcMain.handle("updates:install", async () => installUpdate());
  ipcMain.handle("updates:setEnabled", async (_event, enabled: boolean) => setEnabled(Boolean(enabled)));

  return {
    getState,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    setEnabled
  };
}

function normalizeProgress(progress: ProgressInfoLike): LinuxUpdateProgress {
  return {
    percent: clampProgressNumber(progress.percent),
    transferred: Math.max(0, Math.round(progress.transferred ?? 0)),
    total: Math.max(0, Math.round(progress.total ?? 0)),
    bytesPerSecond: Math.max(0, Math.round(progress.bytesPerSecond ?? 0))
  };
}

function clampProgressNumber(value: unknown): number {
  return Math.min(100, Math.max(0, typeof value === "number" && Number.isFinite(value) ? value : 0));
}

function loadAutoUpdater(): AutoUpdaterLike {
  const updaterModule = require("electron-updater") as ElectronUpdaterModuleLike;
  const autoUpdater = updaterModule.autoUpdater ?? updaterModule.default?.autoUpdater;

  if (!autoUpdater) {
    throw new Error("electron-updater autoUpdater export was not found.");
  }

  return autoUpdater;
}
