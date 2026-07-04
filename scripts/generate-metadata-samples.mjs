import { promises as fs } from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const root = process.cwd();
const inputDir = path.join(root, "samples", "input-metadata");
const projectDir = path.join(root, "samples", "projects");

await fs.mkdir(path.join(inputDir, "characters", "hero"), { recursive: true });
await fs.mkdir(projectDir, { recursive: true });

await writeSample(path.join(inputDir, "characters", "hero", "idle_0.png"), 20, 24, [72, 143, 214, 255], [24, 65, 118, 255]);
await writeSample(path.join(inputDir, "characters", "hero", "idle_1.png"), 20, 24, [86, 181, 122, 255], [30, 91, 58, 255]);
await writeSample(path.join(inputDir, "characters", "hero", "unused.png"), 14, 14, [180, 80, 80, 255], [90, 30, 30, 255]);
await writeSample(path.join(inputDir, "coin.png"), 12, 12, [248, 208, 72, 255], [140, 92, 24, 255]);

const project = {
  version: 1,
  name: "metadata_demo",
  inputDir: "../input-metadata",
  outputDir: "../output-metadata",
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
    "characters/hero/idle_0.png": {
      include: true,
      nameOverride: "hero_idle",
      pivotX: 0.5,
      pivotY: 0.85,
      tags: ["hero", "idle", "hero"],
      group: "hero"
    },
    "characters/hero/idle_1.png": {
      include: true,
      nameOverride: "hero_idle_alt",
      pivotX: 0.5,
      pivotY: 0.8,
      tags: ["hero", "idle"],
      group: "hero"
    },
    "characters/hero/unused.png": {
      include: false,
      tags: ["unused"],
      group: "hero"
    },
    "coin.png": {
      include: true,
      tags: ["pickup"],
      group: "items"
    }
  }
};

await fs.writeFile(
  path.join(projectDir, "metadata-demo.suwol-atlas.json"),
  `${JSON.stringify(project, null, 2)}\n`,
  "utf8"
);

console.log(`Metadata sample PNG files written to ${inputDir}`);
console.log(`Metadata sample project written to ${path.join(projectDir, "metadata-demo.suwol-atlas.json")}`);

async function writeSample(filePath, width, height, fill, border) {
  const png = new PNG({ width, height });

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const isBorder = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      const color = isBorder ? border : fill;
      png.data[index] = color[0];
      png.data[index + 1] = color[1];
      png.data[index + 2] = color[2];
      png.data[index + 3] = color[3];
    }
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, PNG.sync.write(png));
}
