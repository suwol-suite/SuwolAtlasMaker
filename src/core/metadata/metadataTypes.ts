export type SpriteTrimMode = "default" | "auto" | "none" | "manual";

export interface SpriteCropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SpriteMetadataEntry {
  include?: boolean;
  nameOverride?: string;
  pivotX?: number;
  pivotY?: number;
  tags?: string[];
  group?: string;
  order?: number;
  trimMode?: SpriteTrimMode;
  crop?: SpriteCropRect;
}

export type SpriteMetadataMap = Record<string, SpriteMetadataEntry>;

export interface NormalizedSpriteMetadata {
  include: boolean;
  nameOverride?: string;
  pivotX: number;
  pivotY: number;
  tags: string[];
  group: string;
  order?: number;
  trimMode: SpriteTrimMode;
  crop?: SpriteCropRect;
}

export interface AppliedSpriteMetadata extends NormalizedSpriteMetadata {
  sourcePath: string;
  originalName: string;
  exportName: string;
  hasMetadata: boolean;
  nameOverridden: boolean;
  pivotOverridden: boolean;
  orderOverridden: boolean;
  trimModeOverridden: boolean;
  manualCrop: boolean;
}

export interface MetadataStats {
  enabled: boolean;
  totalInputSprites: number;
  includedSprites: number;
  excludedSprites: number;
  renamedSprites: number;
  pivotOverrideSprites: number;
  taggedSprites: number;
  groupedSprites: number;
  orderedSprites: number;
  trimModeOverrideSprites: number;
  manualCropSprites: number;
  sidecarPath: string | null;
}

export interface MetadataSidecarSprite {
  name: string;
  sourcePath: string;
  originalName: string;
  included: true;
  group: string;
  tags: string[];
  pivotX: number;
  pivotY: number;
  order?: number;
  trimMode: SpriteTrimMode;
  crop?: SpriteCropRect;
}

export interface MetadataSidecarJson {
  version: 1;
  atlas: string;
  sprites: MetadataSidecarSprite[];
}
