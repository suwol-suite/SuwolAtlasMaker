import { promises as fs } from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const outputDir = path.resolve("samples/input-advanced");

await fs.rm(outputDir, { recursive: true, force: true });
await fs.mkdir(outputDir, { recursive: true });

await writePng("trimmed_box.png", createTrimmedBox());
await writePng("diamond_alpha.png", createDiamond());
await writePng("long_horizontal.png", createLongHorizontal());
await writePng("long_vertical.png", createLongVertical());
await writePng("fully_transparent.png", new PNG({ width: 16, height: 16 }));

console.log(`Advanced sample PNG files written to ${outputDir}`);

async function writePng(fileName, png) {
  await fs.writeFile(path.join(outputDir, fileName), PNG.sync.write(png));
}

function createTrimmedBox() {
  const png = new PNG({ width: 32, height: 24 });
  fillRect(png, 7, 5, 14, 10, [232, 78, 64, 255]);
  fillRect(png, 10, 8, 8, 4, [255, 226, 118, 255]);
  return png;
}

function createDiamond() {
  const png = new PNG({ width: 24, height: 24 });
  const center = 11.5;

  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const distance = Math.abs(x - center) + Math.abs(y - center);

      if (distance <= 9) {
        setPixel(png, x, y, [92, 205, 172, 255]);
      }
    }
  }

  return png;
}

function createLongHorizontal() {
  const png = new PNG({ width: 56, height: 10 });

  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      setPixel(png, x, y, [62, 118, 210, 255]);
    }
  }

  fillRect(png, 4, 2, 48, 6, [118, 180, 252, 255]);
  return png;
}

function createLongVertical() {
  const png = new PNG({ width: 10, height: 56 });

  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      setPixel(png, x, y, [129, 82, 196, 255]);
    }
  }

  fillRect(png, 2, 4, 6, 48, [192, 142, 255, 255]);
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
