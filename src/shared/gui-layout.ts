export type RightPanelTab = "sprites" | "selected" | "filters" | "batch";
export type PreviewEmptyReason = "input" | "output" | "sprites" | "atlas" | "error" | "none";

const RIGHT_PANEL_TABS = new Set<RightPanelTab>(["sprites", "selected", "filters", "batch"]);

export function normalizeRightPanelTab(value: unknown): RightPanelTab {
  return RIGHT_PANEL_TABS.has(value as RightPanelTab) ? value as RightPanelTab : "sprites";
}

export function normalizeCollapsedState(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
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
