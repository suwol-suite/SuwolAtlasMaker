import type { SpriteContent } from "../image/types.js";
import type { AppliedSpriteMetadata } from "../metadata/metadataTypes.js";
import type { PackingAlgorithm } from "../../shared/packing.js";

export interface PackOptions {
  maxSize: number;
  padding: number;
  extrude: number;
  rotate: boolean;
  algorithm: PackingAlgorithm;
}

export interface Packer {
  pack(sprites: SpriteContent[], options: PackOptions): PackResult;
}

export interface PackedSprite {
  name: string;
  filePath: string;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  spriteX: number;
  spriteY: number;
  spriteW: number;
  spriteH: number;
  drawX: number;
  drawY: number;
  drawW: number;
  drawH: number;
  rotated: boolean;
  sourceW: number;
  sourceH: number;
  contentW: number;
  contentH: number;
  offsetX: number;
  offsetY: number;
  trimmed: boolean;
  extrude: number;
  image: SpriteContent;
  metadata?: AppliedSpriteMetadata;
}

export interface PackPage {
  index: number;
  rawWidth: number;
  rawHeight: number;
  width: number;
  height: number;
  sprites: PackedSprite[];
}

export interface PackResult {
  algorithm: PackingAlgorithm;
  pages: PackPage[];
  sprites: PackedSprite[];
  logs: string[];
  warnings: string[];
}
