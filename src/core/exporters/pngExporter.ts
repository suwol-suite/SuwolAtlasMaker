import { promises as fs } from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { SuwolAtlasError } from "../../shared/errors.js";
import type { PackResult, PackedSprite } from "../packer/types.js";
import { getAtlasPageImageName } from "./pageNaming.js";

export async function writeAtlasPng(
  outputDir: string,
  name: string,
  packResult: PackResult
): Promise<string> {
  const outputPaths = await writeAtlasPngs(outputDir, name, packResult);
  return outputPaths[0];
}

export async function writeAtlasPngs(
  outputDir: string,
  name: string,
  packResult: PackResult
): Promise<string[]> {
  const outputPaths: string[] = [];

  for (const page of packResult.pages) {
    const atlas = new PNG({
      width: page.width,
      height: page.height
    });

    for (const sprite of page.sprites) {
      copySprite(atlas, sprite);
    }

    const outputPath = path.join(
      outputDir,
      getAtlasPageImageName(name, page.index, packResult.pages.length)
    );
    await fs.writeFile(outputPath, PNG.sync.write(atlas));
    outputPaths.push(outputPath);
  }

  return outputPaths;
}

function copySprite(atlas: PNG, sprite: PackedSprite): void {
  const extruded = buildExtrudedPng(sprite.image.png, sprite.extrude);
  const source = sprite.rotated ? rotateClockwise(extruded) : extruded;

  if (source.width !== sprite.drawW || source.height !== sprite.drawH) {
    throw new SuwolAtlasError(`Packed sprite "${sprite.name}" draw size does not match bitmap size.`, {
      code: "SPRITE_DRAW_SIZE_MISMATCH",
      filePath: sprite.filePath
    });
  }

  if (sprite.drawX + sprite.drawW > atlas.width || sprite.drawY + sprite.drawH > atlas.height) {
    throw new SuwolAtlasError(`Packed sprite "${sprite.name}" is outside atlas bounds.`, {
      code: "SPRITE_OUT_OF_ATLAS_BOUNDS",
      filePath: sprite.filePath
    });
  }

  for (let row = 0; row < sprite.drawH; row += 1) {
    const sourceStart = row * source.width * 4;
    const sourceEnd = sourceStart + sprite.drawW * 4;
    const targetStart = ((sprite.drawY + row) * atlas.width + sprite.drawX) * 4;
    source.data.copy(atlas.data, targetStart, sourceStart, sourceEnd);
  }
}

function buildExtrudedPng(source: PNG, extrude: number): PNG {
  if (extrude === 0) {
    return source;
  }

  const target = new PNG({
    width: source.width + extrude * 2,
    height: source.height + extrude * 2
  });

  for (let y = 0; y < target.height; y += 1) {
    for (let x = 0; x < target.width; x += 1) {
      const sourceX = clamp(x - extrude, 0, source.width - 1);
      const sourceY = clamp(y - extrude, 0, source.height - 1);
      copyPixel(source, sourceX, sourceY, target, x, y);
    }
  }

  return target;
}

function rotateClockwise(source: PNG): PNG {
  const target = new PNG({
    width: source.height,
    height: source.width
  });

  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const targetX = source.height - 1 - y;
      const targetY = x;
      copyPixel(source, x, y, target, targetX, targetY);
    }
  }

  return target;
}

function copyPixel(source: PNG, sourceX: number, sourceY: number, target: PNG, targetX: number, targetY: number): void {
  const sourceIndex = (sourceY * source.width + sourceX) * 4;
  const targetIndex = (targetY * target.width + targetX) * 4;

  target.data[targetIndex] = source.data[sourceIndex];
  target.data[targetIndex + 1] = source.data[sourceIndex + 1];
  target.data[targetIndex + 2] = source.data[sourceIndex + 2];
  target.data[targetIndex + 3] = source.data[sourceIndex + 3];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
