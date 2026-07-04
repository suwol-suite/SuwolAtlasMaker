export type SizeMode = "tight" | "pot" | "square-pot";

export const SIZE_MODES: SizeMode[] = ["tight", "pot", "square-pot"];
export const DEFAULT_SIZE_MODE: SizeMode = "tight";

export function isSizeMode(value: unknown): value is SizeMode {
  return typeof value === "string" && SIZE_MODES.includes(value as SizeMode);
}

export function normalizeSizeMode(value: unknown): SizeMode {
  return isSizeMode(value) ? value : DEFAULT_SIZE_MODE;
}
