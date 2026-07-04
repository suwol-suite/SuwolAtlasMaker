import { promises as fs } from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const root = process.cwd();
const inputDir = path.join(root, "samples", "input-editing");
const projectDir = path.join(root, "samples", "projects");

await fs.mkdir(inputDir, { recursive: true });
await fs.mkdir(projectDir, { recursive: true });

await writeSprite(path.join(inputDir, "manual_crop.png"), 36, 32, { x: 4, y: 6, w: 24, h: 18 }, [92, 142, 224, 255]);
await writeSprite(path.join(inputDir, "auto_trim.png"), 32, 30, { x: 7, y: 5, w: 16, h: 18 }, [88, 196, 126, 255]);
await writeSprite(path.join(inputDir, "no_trim.png"), 28, 28, { x: 8, y: 8, w: 12, h: 12 }, [239, 183, 73, 255]);
await writeSprite(path.join(inputDir, "default_trim.png"), 24, 20, { x: 2, y: 3, w: 18, h: 14 }, [219, 106, 122, 255]);
await writeSprite(path.join(inputDir, "excluded.png"), 16, 16, { x: 2, y: 2, w: 12, h: 12 }, [128, 128, 148, 255]);

const project = {
  version: 1,
  name: "editing_demo",
  inputDir: "../input-editing",
  outputDir: "../output-editing",
  profile: "unity",
  options: {
    algorithm: "maxrects",
    sizeMode: "pot",
    cache: true,
    watch: false,
    maxSize: 2048,
    padding: 2,
    trim: true,
    extrude: 1,
    rotate: true,
    clean: true
  },
  sprites: {
    "manual_crop.png": {
      include: true,
      nameOverride: "manual_panel",
      pivotX: 0.25,
      pivotY: 0.75,
      tags: ["manual", "ui"],
      group: "ui",
      order: 0,
      trimMode: "manual",
      crop: {
        x: 4,
        y: 6,
        w: 20,
        h: 16
      }
    },
    "auto_trim.png": {
      include: true,
      nameOverride: "auto_character",
      pivotX: 0.5,
      pivotY: 0.9,
      tags: ["auto", "character"],
      group: "characters",
      order: 10,
      trimMode: "auto"
    },
    "no_trim.png": {
      include: true,
      tags: ["full"],
      group: "items",
      order: 20,
      trimMode: "none"
    },
    "default_trim.png": {
      include: true,
      tags: ["default"],
      group: "items",
      order: 30,
      trimMode: "default"
    },
    "excluded.png": {
      include: false,
      tags: ["unused"],
      group: "debug",
      order: 40
    }
  }
};

await fs.writeFile(
  path.join(projectDir, "editing-demo.suwol-atlas.json"),
  `${JSON.stringify(project, null, 2)}\n`,
  "utf8"
);

console.log(`Editing sample PNG files written to ${inputDir}`);
console.log(`Editing sample project written to ${path.join(projectDir, "editing-demo.suwol-atlas.json")}`);

async function writeSprite(filePath, width, height, rect, fill) {
  const png = new PNG({ width, height });

  for (let y = rect.y; y < rect.y + rect.h; y += 1) {
    for (let x = rect.x; x < rect.x + rect.w; x += 1) {
      const index = (y * width + x) * 4;
      const border = x === rect.x || y === rect.y || x === rect.x + rect.w - 1 || y === rect.y + rect.h - 1;
      png.data[index] = border ? Math.max(0, fill[0] - 48) : fill[0];
      png.data[index + 1] = border ? Math.max(0, fill[1] - 48) : fill[1];
      png.data[index + 2] = border ? Math.max(0, fill[2] - 48) : fill[2];
      png.data[index + 3] = fill[3];
    }
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, PNG.sync.write(png));
}
