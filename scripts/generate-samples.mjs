import { promises as fs } from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const outputDir = path.resolve("samples/input");

await fs.mkdir(outputDir, { recursive: true });

await writeSample("hero_idle_0.png", 24, 18, [74, 144, 226, 255], [31, 72, 122, 255]);
await writeSample("hero_idle_1.png", 24, 18, [80, 190, 120, 255], [32, 96, 64, 255]);
await writeSample("coin.png", 12, 12, [248, 208, 72, 255], [140, 92, 24, 255]);

console.log(`Sample PNG files written to ${outputDir}`);

async function writeSample(fileName, width, height, fill, border) {
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

  await fs.writeFile(path.join(outputDir, fileName), PNG.sync.write(png));
}
