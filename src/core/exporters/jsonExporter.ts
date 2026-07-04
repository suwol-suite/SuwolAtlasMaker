import { promises as fs } from "node:fs";
import path from "node:path";
import type { PackResult } from "../packer/types.js";
import { getAtlasPageImageName } from "./pageNaming.js";

export interface AtlasJsonPage {
  image: string;
  width: number;
  height: number;
}

export interface AtlasJsonSprite {
  name: string;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  rotated: boolean;
  trimmed: boolean;
  sourceW: number;
  sourceH: number;
  offsetX: number;
  offsetY: number;
  pivotX: number;
  pivotY: number;
}

export interface AtlasJson {
  version: 1;
  name: string;
  pages: AtlasJsonPage[];
  sprites: AtlasJsonSprite[];
}

export function buildAtlasJson(name: string, packResult: PackResult): AtlasJson {
  return {
    version: 1,
    name,
    pages: packResult.pages.map((page) => ({
      image: getAtlasPageImageName(name, page.index, packResult.pages.length),
      width: page.width,
      height: page.height
    })),
    sprites: packResult.sprites.map((sprite) => ({
      name: sprite.name,
      page: sprite.page,
      x: sprite.x,
      y: sprite.y,
      w: sprite.w,
      h: sprite.h,
      rotated: sprite.rotated,
      trimmed: sprite.trimmed,
      sourceW: sprite.sourceW,
      sourceH: sprite.sourceH,
      offsetX: sprite.offsetX,
      offsetY: sprite.offsetY,
      pivotX: sprite.metadata?.pivotX ?? 0.5,
      pivotY: sprite.metadata?.pivotY ?? 0.5
    }))
  };
}

export async function writeAtlasJson(
  outputDir: string,
  name: string,
  packResult: PackResult
): Promise<string> {
  const outputPath = path.join(outputDir, `${name}.json`);
  const json = buildAtlasJson(name, packResult);
  await fs.writeFile(outputPath, `${JSON.stringify(json, null, 2)}\n`, "utf8");
  return outputPath;
}
