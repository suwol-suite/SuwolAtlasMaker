import { SuwolAtlasError } from "../../shared/errors.js";
import { isPackingAlgorithm, type PackingAlgorithm } from "../../shared/packing.js";
import type { SpriteContent } from "../image/types.js";
import { maxRectsPacker } from "./maxRectsPacker.js";
import { shelfPacker } from "./shelfPacker.js";
import type { Packer, PackOptions, PackResult } from "./types.js";

export function createPacker(algorithm: PackingAlgorithm): Packer {
  if (algorithm === "shelf") {
    return shelfPacker;
  }

  if (algorithm === "maxrects") {
    return maxRectsPacker;
  }

  throw new SuwolAtlasError(`Unsupported packing algorithm: ${algorithm}`, {
    code: "UNSUPPORTED_PACKING_ALGORITHM"
  });
}

export function parsePackingAlgorithm(value: unknown): PackingAlgorithm {
  if (isPackingAlgorithm(value)) {
    return value;
  }

  throw new SuwolAtlasError('Unsupported packing algorithm. Expected "shelf" or "maxrects".', {
    code: "UNSUPPORTED_PACKING_ALGORITHM"
  });
}

export function packSprites(sprites: SpriteContent[], options: PackOptions): PackResult {
  return createPacker(options.algorithm).pack(sprites, options);
}
