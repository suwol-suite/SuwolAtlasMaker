import { promises as fs } from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const root = process.cwd();
const brandDir = path.join(root, "assets", "brand");
const buildDir = path.join(root, "build");
const sourceIconPath = path.join(brandDir, "icon-source.png");

await fs.mkdir(brandDir, { recursive: true });
await fs.mkdir(buildDir, { recursive: true });

const sourceIcon = PNG.sync.read(await fs.readFile(sourceIconPath));
const icon256 = resizeIcon(sourceIcon, 256);
const icon512 = resizeIcon(sourceIcon, 512);
const icon64 = resizeIcon(sourceIcon, 64);
const icon48 = resizeIcon(sourceIcon, 48);
const icon32 = resizeIcon(sourceIcon, 32);

await fs.writeFile(path.join(brandDir, "icon.svg"), buildSvg(), "utf8");
await fs.writeFile(path.join(brandDir, "icon-256.png"), PNG.sync.write(icon256));
await fs.writeFile(path.join(brandDir, "icon-512.png"), PNG.sync.write(icon512));
await fs.writeFile(path.join(buildDir, "icon.png"), PNG.sync.write(icon512));
await fs.writeFile(
  path.join(buildDir, "icon.ico"),
  makeIco([
    PNG.sync.write(icon32),
    PNG.sync.write(icon48),
    PNG.sync.write(icon64),
    PNG.sync.write(icon256)
  ])
);

console.log("Suwol Atlas Maker icons generated from assets/brand/icon-source.png.");

function resizeIcon(source, size) {
  const output = new PNG({ width: size, height: size });
  clear(output);

  const scale = Math.min(size / source.width, size / source.height);
  const targetWidth = Math.max(1, Math.round(source.width * scale));
  const targetHeight = Math.max(1, Math.round(source.height * scale));
  const offsetX = Math.floor((size - targetWidth) / 2);
  const offsetY = Math.floor((size - targetHeight) / 2);

  for (let y = 0; y < targetHeight; y += 1) {
    for (let x = 0; x < targetWidth; x += 1) {
      const sourceX = (x + 0.5) / scale - 0.5;
      const sourceY = (y + 0.5) / scale - 0.5;
      setPixel(output, offsetX + x, offsetY + y, sampleBilinear(source, sourceX, sourceY));
    }
  }

  return output;
}

function sampleBilinear(png, x, y) {
  const x0 = clamp(Math.floor(x), 0, png.width - 1);
  const y0 = clamp(Math.floor(y), 0, png.height - 1);
  const x1 = clamp(x0 + 1, 0, png.width - 1);
  const y1 = clamp(y0 + 1, 0, png.height - 1);
  const tx = clamp(x - x0, 0, 1);
  const ty = clamp(y - y0, 0, 1);
  const weights = [
    [(1 - tx) * (1 - ty), x0, y0],
    [tx * (1 - ty), x1, y0],
    [(1 - tx) * ty, x0, y1],
    [tx * ty, x1, y1]
  ];

  let alpha = 0;
  let red = 0;
  let green = 0;
  let blue = 0;

  for (const [weight, sampleX, sampleY] of weights) {
    const [r, g, b, a] = getPixel(png, sampleX, sampleY);
    const weightedAlpha = a * weight;
    alpha += weightedAlpha;
    red += r * weightedAlpha;
    green += g * weightedAlpha;
    blue += b * weightedAlpha;
  }

  if (alpha <= 0) {
    return [0, 0, 0, 0];
  }

  return [
    Math.round(red / alpha),
    Math.round(green / alpha),
    Math.round(blue / alpha),
    Math.round(alpha)
  ];
}

function buildSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Suwol Atlas Maker icon">
  <image href="icon-source.png" width="512" height="512" preserveAspectRatio="xMidYMid meet"/>
</svg>
`;
}

function makeIco(pngBuffers) {
  const count = pngBuffers.length;
  const headerSize = 6 + count * 16;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  let offset = headerSize;

  for (let index = 0; index < count; index += 1) {
    const image = PNG.sync.read(pngBuffers[index]);
    const entryOffset = 6 + index * 16;
    header.writeUInt8(image.width >= 256 ? 0 : image.width, entryOffset);
    header.writeUInt8(image.height >= 256 ? 0 : image.height, entryOffset + 1);
    header.writeUInt8(0, entryOffset + 2);
    header.writeUInt8(0, entryOffset + 3);
    header.writeUInt16LE(1, entryOffset + 4);
    header.writeUInt16LE(32, entryOffset + 6);
    header.writeUInt32LE(pngBuffers[index].length, entryOffset + 8);
    header.writeUInt32LE(offset, entryOffset + 12);
    offset += pngBuffers[index].length;
  }

  return Buffer.concat([header, ...pngBuffers]);
}

function clear(png) {
  for (let index = 0; index < png.data.length; index += 4) {
    png.data[index] = 0;
    png.data[index + 1] = 0;
    png.data[index + 2] = 0;
    png.data[index + 3] = 0;
  }
}

function getPixel(png, x, y) {
  const index = (y * png.width + x) * 4;
  return [
    png.data[index],
    png.data[index + 1],
    png.data[index + 2],
    png.data[index + 3]
  ];
}

function setPixel(png, x, y, color) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) {
    return;
  }

  const index = (y * png.width + x) * 4;
  png.data[index] = color[0];
  png.data[index + 1] = color[1];
  png.data[index + 2] = color[2];
  png.data[index + 3] = color[3];
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
