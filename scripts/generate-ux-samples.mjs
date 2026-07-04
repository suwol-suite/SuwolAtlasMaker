import { promises as fs } from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const root = process.cwd();
const inputDir = path.join(root, "samples", "input-ux");
const projectDir = path.join(root, "samples", "projects");

await fs.mkdir(inputDir, { recursive: true });
await fs.mkdir(projectDir, { recursive: true });

await writeSprite(path.join(inputDir, "crop_target.png"), 48, 36, { x: 8, y: 7, w: 28, h: 20 }, [84, 156, 214, 255]);
await writeSprite(path.join(inputDir, "pivot_target.png"), 40, 40, { x: 10, y: 6, w: 18, h: 28 }, [111, 201, 142, 255]);
await writeSprite(path.join(inputDir, "auto_trim.png"), 34, 30, { x: 6, y: 5, w: 20, h: 16 }, [222, 178, 76, 255]);
await writeSprite(path.join(inputDir, "no_trim.png"), 28, 28, { x: 7, y: 7, w: 14, h: 14 }, [218, 104, 128, 255]);
await writeSprite(path.join(inputDir, "excluded_debug.png"), 18, 18, { x: 2, y: 2, w: 14, h: 14 }, [130, 137, 151, 255]);

const project = {
  version: 1,
  name: "ux_demo",
  inputDir: "../input-ux",
  outputDir: "../output-ux",
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
    "crop_target.png": {
      include: true,
      nameOverride: "manual_crop_target",
      pivotX: 0.25,
      pivotY: 0.75,
      tags: ["manual", "ux"],
      group: "editor",
      order: 0,
      trimMode: "manual",
      crop: { x: 8, y: 7, w: 24, h: 18 }
    },
    "pivot_target.png": {
      include: true,
      nameOverride: "custom_pivot_target",
      pivotX: 0.5,
      pivotY: 1,
      tags: ["pivot", "ux"],
      group: "editor",
      order: 10,
      trimMode: "auto"
    },
    "auto_trim.png": {
      include: true,
      tags: ["auto"],
      group: "items",
      order: 20,
      trimMode: "auto"
    },
    "no_trim.png": {
      include: true,
      tags: ["full"],
      group: "items",
      order: 30,
      trimMode: "none"
    },
    "excluded_debug.png": {
      include: false,
      tags: ["excluded"],
      group: "debug",
      order: 40
    },
    "missing_old_file.png": {
      include: true,
      tags: ["cleanup"],
      group: "stale",
      order: 50
    }
  }
};

await fs.writeFile(
  path.join(projectDir, "ux-demo.suwol-atlas.json"),
  `${JSON.stringify(project, null, 2)}\n`,
  "utf8"
);

console.log(`UX sample PNG files written to ${inputDir}`);
console.log(`UX sample project written to ${path.join(projectDir, "ux-demo.suwol-atlas.json")}`);

async function writeSprite(filePath, width, height, rect, fill) {
  const png = new PNG({ width, height });

  for (let y = rect.y; y < rect.y + rect.h; y += 1) {
    for (let x = rect.x; x < rect.x + rect.w; x += 1) {
      const index = (y * width + x) * 4;
      const edge = x === rect.x || y === rect.y || x === rect.x + rect.w - 1 || y === rect.y + rect.h - 1;
      png.data[index] = edge ? Math.max(0, fill[0] - 54) : fill[0];
      png.data[index + 1] = edge ? Math.max(0, fill[1] - 54) : fill[1];
      png.data[index + 2] = edge ? Math.max(0, fill[2] - 54) : fill[2];
      png.data[index + 3] = fill[3];
    }
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, PNG.sync.write(png));
}
