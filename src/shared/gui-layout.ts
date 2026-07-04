export type RightPanelTab = "sprites" | "selected" | "filters" | "batch";
export type PreviewEmptyReason = "input" | "output" | "sprites" | "atlas" | "error" | "none";
export type PreviewEmptyAction = "select-input" | "select-output" | "scan" | "export" | "diagnostics" | "none";

export interface GuiLayoutSettings {
  leftPanelWidth: number;
  rightPanelWidth: number;
  bottomLogHeight: number;
  logCollapsed: boolean;
  advancedCollapsed: boolean;
  rightPanelTab: RightPanelTab;
}

const RIGHT_PANEL_TABS = new Set<RightPanelTab>(["sprites", "selected", "filters", "batch"]);

export const GUI_LAYOUT_LIMITS = {
  leftPanelWidth: { min: 260, max: 480 },
  rightPanelWidth: { min: 320, max: 560 },
  bottomLogHeight: { min: 120, max: 420 }
} as const;

export const DEFAULT_GUI_LAYOUT: GuiLayoutSettings = {
  leftPanelWidth: 300,
  rightPanelWidth: 360,
  bottomLogHeight: 220,
  logCollapsed: true,
  advancedCollapsed: true,
  rightPanelTab: "sprites"
};

export function normalizeRightPanelTab(value: unknown): RightPanelTab {
  return RIGHT_PANEL_TABS.has(value as RightPanelTab) ? value as RightPanelTab : "sprites";
}

export function normalizeCollapsedState(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function clampGuiLayoutValue(key: keyof typeof GUI_LAYOUT_LIMITS, value: unknown, fallback = DEFAULT_GUI_LAYOUT[key]): number {
  const limits = GUI_LAYOUT_LIMITS[key];
  const numeric = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : fallback;

  return Math.min(limits.max, Math.max(limits.min, numeric));
}

export function normalizeGuiLayoutSettings(
  value: unknown,
  fallback: Partial<GuiLayoutSettings> = {}
): GuiLayoutSettings {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Partial<Record<keyof GuiLayoutSettings, unknown>>
    : {};
  const nextFallback = { ...DEFAULT_GUI_LAYOUT };

  if (fallback.leftPanelWidth !== undefined) {
    nextFallback.leftPanelWidth = fallback.leftPanelWidth;
  }

  if (fallback.rightPanelWidth !== undefined) {
    nextFallback.rightPanelWidth = fallback.rightPanelWidth;
  }

  if (fallback.bottomLogHeight !== undefined) {
    nextFallback.bottomLogHeight = fallback.bottomLogHeight;
  }

  if (fallback.logCollapsed !== undefined) {
    nextFallback.logCollapsed = fallback.logCollapsed;
  }

  if (fallback.advancedCollapsed !== undefined) {
    nextFallback.advancedCollapsed = fallback.advancedCollapsed;
  }

  if (fallback.rightPanelTab !== undefined) {
    nextFallback.rightPanelTab = fallback.rightPanelTab;
  }

  return {
    leftPanelWidth: clampGuiLayoutValue("leftPanelWidth", source.leftPanelWidth, nextFallback.leftPanelWidth),
    rightPanelWidth: clampGuiLayoutValue("rightPanelWidth", source.rightPanelWidth, nextFallback.rightPanelWidth),
    bottomLogHeight: clampGuiLayoutValue("bottomLogHeight", source.bottomLogHeight, nextFallback.bottomLogHeight),
    logCollapsed: normalizeCollapsedState(source.logCollapsed, nextFallback.logCollapsed),
    advancedCollapsed: normalizeCollapsedState(source.advancedCollapsed, nextFallback.advancedCollapsed),
    rightPanelTab: normalizeRightPanelTab(source.rightPanelTab ?? nextFallback.rightPanelTab)
  };
}

export function getPreviewEmptyAction(reason: PreviewEmptyReason): PreviewEmptyAction {
  if (reason === "input") {
    return "select-input";
  }

  if (reason === "output") {
    return "select-output";
  }

  if (reason === "sprites") {
    return "scan";
  }

  if (reason === "atlas") {
    return "export";
  }

  if (reason === "error") {
    return "diagnostics";
  }

  return "none";
}

export function getPreviewEmptyReason(input: {
  hasInput: boolean;
  hasOutput: boolean;
  spriteCount: number;
  hasAtlas: boolean;
  hasError: boolean;
}): PreviewEmptyReason {
  if (input.hasError) {
    return "error";
  }

  if (!input.hasInput) {
    return "input";
  }

  if (!input.hasOutput) {
    return "output";
  }

  if (input.spriteCount === 0) {
    return "sprites";
  }

  return input.hasAtlas ? "none" : "atlas";
}
