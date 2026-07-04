export type PackingAlgorithm = "shelf" | "maxrects";

export const PACKING_ALGORITHMS: PackingAlgorithm[] = ["shelf", "maxrects"];
export const DEFAULT_PACKING_ALGORITHM: PackingAlgorithm = "shelf";

export function isPackingAlgorithm(value: unknown): value is PackingAlgorithm {
  return typeof value === "string" && PACKING_ALGORITHMS.includes(value as PackingAlgorithm);
}

export function normalizePackingAlgorithm(value: unknown): PackingAlgorithm {
  return isPackingAlgorithm(value) ? value : DEFAULT_PACKING_ALGORITHM;
}
