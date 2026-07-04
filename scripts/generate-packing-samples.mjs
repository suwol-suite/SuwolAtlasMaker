import { promises as fs } from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const outputDir = path.resolve("samples/input-packing");

await fs.rm(outputDir, { recursive: true, force: true });
await fs.mkdir(outputDir, { recursive: true });

await writePng("tall_panel.png", makePanel(5, 9, [48, 116, 154, 255], [139, 226, 189, 255]));
await writePng("chip_a.png", makePanel(2, 2, [255, 157, 168, 255], [255, 207, 138, 255]));
await writePng("chip_b.png", makePanel(2, 2, [181, 206, 255, 255], [230, 237, 243, 255]));
await writePng("chip_c.png", makePanel(2, 2, [132, 181, 215, 255], [139, 226, 189, 255]));

console.log(`Packing comparison sample PNG files written to ${outputDir}`);

async function writePng(fileName, png) {
  await fs.writeFile(path.join(outputDir, fileName), PNG.sync.write(png));
}

function makePanel(width, height, base, accent) {
  const png = new PNG({ width, height });
  fillRect(png, 0, 0, width, height, base);

  if (width > 2 && height > 2) {
    fillRect(png, 1, 1, width - 2, height - 2, accent);
  }

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
