import { InvalidArgumentError } from "commander";
import { isPackingAlgorithm, type PackingAlgorithm } from "../shared/packing.js";
import { isSizeMode, type SizeMode } from "../shared/sizeMode.js";

export function parsePositiveInteger(value: string): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new InvalidArgumentError("Expected a positive integer.");
  }

  return parsed;
}

export function parseNonNegativeInteger(value: string): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new InvalidArgumentError("Expected a non-negative integer.");
  }

  return parsed;
}

export function parsePackingAlgorithmOption(value: string): PackingAlgorithm {
  if (!isPackingAlgorithm(value)) {
    throw new InvalidArgumentError('Expected "shelf" or "maxrects".');
  }

  return value;
}

export function parseSizeModeOption(value: string): SizeMode {
  if (!isSizeMode(value)) {
    throw new InvalidArgumentError('Expected "tight", "pot", or "square-pot".');
  }

  return value;
}
