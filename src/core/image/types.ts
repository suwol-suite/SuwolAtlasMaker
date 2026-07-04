import type { PNG } from "pngjs";
import type { AppliedSpriteMetadata } from "../metadata/metadataTypes.js";

export interface LoadedImage {
  name: string;
  filePath: string;
  width: number;
  height: number;
  png: PNG;
  metadata?: AppliedSpriteMetadata;
}

export interface SpriteContent {
  name: string;
  filePath: string;
  sourceW: number;
  sourceH: number;
  contentW: number;
  contentH: number;
  offsetX: number;
  offsetY: number;
  trimmed: boolean;
  png: PNG;
  metadata?: AppliedSpriteMetadata;
}

export interface PrepareImageOptions {
  trim: boolean;
}
