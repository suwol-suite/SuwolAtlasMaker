import { promises as fs } from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const outputDir = path.resolve("samples/input-multipack");

await fs.rm(outputDir, { recursive: true, force: true });
await fs.mkdir(outputDir, { recursive: true });

const colors = [
  [232, 78, 64, 255],
  [92, 205, 172, 255],
  [62, 118, 210, 255],
  [248, 208, 72, 255],
  [168, 112, 216, 255],
  [245, 141, 66, 255],
  [80, 190, 120, 255],
  [74, 144, 226, 255]
];

for (let i = 0; i < 8; i += 1) {
  await writePng(`block_${String(i).padStart(2, "0")}.png`, createTrimmedBlock(colors[i]));
}

await writePng("long_horizontal.png", createStripe(116, 20, [74, 144, 226, 255], [180, 215, 255, 255]));
await writePng("long_vertical.png", createStripe(20, 116, [168, 112, 216, 255], [220, 196, 255, 255]));
await writePng("edge_quad.png", createEdgeQuad());

console.log(`Multipack sample PNG files written to ${outputDir}`);

async function writePng(fileName, png) {
  await fs.writeFile(path.join(outputDir, fileName), PNG.sync.write(png));
}

function createTrimmedBlock(color) {
  const png = new PNG({ width: 64, height: 64 });
  fillRect(png, 6, 6, 52, 52, color);
  fillRect(png, 12, 12, 40, 8, [255, 255, 255, 150]);
  return png;
}

function createStripe(width, height, base, accent) {
  const png = new PNG({ width, height });
  fillRect(png, 0, 0, width, height, base);
  fillRect(png, 4, 4, Math.max(1, width - 8), Math.max(1, height - 8), accent);
  return png;
}

function createEdgeQuad() {
  const png = new PNG({ width: 18, height: 18 });
  fillRect(png, 4, 4, 10, 10, [255, 0, 0, 255]);
  fillRect(png, 9, 4, 5, 5, [0, 255, 0, 255]);
  fillRect(png, 4, 9, 5, 5, [0, 0, 255, 255]);
  fillRect(png, 9, 9, 5, 5, [255, 255, 0, 255]);
  return png;
}

function fillRect(png, x, y, width, height, color) {
  for (let row = y; row < y + height; row += 1) {
    for (let column = x; column < x + width; column += 1) {
      setPixel(png, column, row, color);
    }
  }
}

function setPixel(png, x, y, color) {
  const index = (y * png.width + x) * 4;
  png.data[index] = color[0];
  png.data[index + 1] = color[1];
  png.data[index + 2] = color[2];
  png.data[index + 3] = color[3];
}
