import { promises as fs } from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { SuwolAtlasError } from "../../shared/errors.js";
import { isPngFile, withoutExtension } from "../../shared/paths.js";
import type { LoadedImage } from "./types.js";

export async function listPngFiles(inputDir: string): Promise<string[]> {
  const root = path.resolve(inputDir);
  const files: string[] = [];

  async function walk(dir: string): Promise<void> {
    let entries;

    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (error) {
      throw new SuwolAtlasError(`Failed to read input directory: ${dir}`, {
        code: "INPUT_READ_FAILED",
        filePath: dir,
        cause: error
      });
    }

    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }

      if (entry.isFile() && isPngFile(fullPath)) {
        files.push(fullPath);
      }
    }
  }

  await walk(root);

  files.sort((a, b) => path.relative(root, a).localeCompare(path.relative(root, b)));
  return files;
}

export async function loadPngImages(inputDir: string): Promise<LoadedImage[]> {
  const pngFiles = await listPngFiles(inputDir);

  if (pngFiles.length === 0) {
    throw new SuwolAtlasError(`No PNG files found in input directory: ${path.resolve(inputDir)}`, {
      code: "NO_PNG_FILES",
      filePath: path.resolve(inputDir)
    });
  }

  const images: LoadedImage[] = [];

  for (const filePath of pngFiles) {
    const name = withoutExtension(filePath);

    let png: PNG;

    try {
      const buffer = await fs.readFile(filePath);
      png = PNG.sync.read(buffer);
    } catch (error) {
      throw new SuwolAtlasError(`Failed to read PNG file: ${filePath}`, {
        code: "PNG_READ_FAILED",
        filePath,
        cause: error
      });
    }

    images.push({
      name,
      filePath,
      width: png.width,
      height: png.height,
      png
    });
  }

  return images;
}
