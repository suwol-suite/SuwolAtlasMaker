import { promises as fs } from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const root = process.cwd();
const brandDir = path.join(root, "assets", "brand");
const buildDir = path.join(root, "build");

await fs.mkdir(brandDir, { recursive: true });
await fs.mkdir(buildDir, { recursive: true });

await fs.writeFile(path.join(brandDir, "icon.svg"), buildSvg(), "utf8");

const icon256 = makeIcon(256);
const icon512 = makeIcon(512);
const icon64 = makeIcon(64);
const icon48 = makeIcon(48);
const icon32 = makeIcon(32);

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

console.log("Suwol Atlas Maker icons generated.");

function makeIcon(size) {
  const png = new PNG({ width: size, height: size });
  clear(png);

  fillRoundedRect(png, 0, 0, size, size, Math.round(size * 0.16), [15, 20, 27, 255]);
  fillRoundedRect(png, size * 0.09, size * 0.09, size * 0.82, size * 0.82, size * 0.1, [33, 44, 58, 255]);
  fillRoundedRect(png, size * 0.14, size * 0.14, size * 0.72, size * 0.72, size * 0.06, [48, 116, 154, 255]);

  const gap = Math.max(2, Math.round(size * 0.018));
  const tile = Math.round(size * 0.18);
  const startX = Math.round(size * 0.22);
  const startY = Math.round(size * 0.22);
  const colors = [
    [139, 226, 189, 255],
    [255, 207, 138, 255],
    [181, 206, 255, 255],
    [255, 157, 168, 255],
    [230, 237, 243, 255],
    [132, 181, 215, 255]
  ];

  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      if (row === 2 && column === 2) {
        continue;
      }

      const x = startX + column * (tile + gap);
      const y = startY + row * (tile + gap);
      const w = column === 1 && row === 0 ? tile + gap + tile : tile;
      const h = column === 0 && row === 1 ? tile + gap + tile : tile;
      fillRoundedRect(png, x, y, w, h, Math.max(2, Math.round(size * 0.02)), colors[(row * 3 + column) % colors.length]);
    }
  }

  fillRoundedRect(png, size * 0.6, size * 0.64, size * 0.18, size * 0.18, size * 0.02, [255, 207, 138, 255]);
  strokeRoundedRect(png, size * 0.12, size * 0.12, size * 0.76, size * 0.76, size * 0.07, [198, 223, 242, 255], Math.max(2, Math.round(size * 0.012)));

  return png;
}

function buildSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Suwol Atlas Maker icon">
  <rect width="512" height="512" rx="82" fill="#0f141b"/>
  <rect x="46" y="46" width="420" height="420" rx="52" fill="#212c3a"/>
  <rect x="72" y="72" width="368" height="368" rx="31" fill="#30749a"/>
  <rect x="112" y="112" width="92" height="92" rx="10" fill="#8be2bd"/>
  <rect x="214" y="112" width="194" height="92" rx="10" fill="#ffcf8a"/>
  <rect x="112" y="214" width="92" height="194" rx="10" fill="#b5ceff"/>
  <rect x="214" y="214" width="92" height="92" rx="10" fill="#ff9da8"/>
  <rect x="316" y="214" width="92" height="92" rx="10" fill="#e6edf3"/>
  <rect x="214" y="316" width="92" height="92" rx="10" fill="#84b5d7"/>
  <rect x="316" y="326" width="92" height="92" rx="10" fill="#ffcf8a"/>
  <rect x="61" y="61" width="390" height="390" rx="36" fill="none" stroke="#c6dff2" stroke-width="7"/>
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

function fillRoundedRect(png, rawX, rawY, rawW, rawH, rawRadius, color) {
  const x = Math.round(rawX);
  const y = Math.round(rawY);
  const w = Math.round(rawW);
  const h = Math.round(rawH);
  const radius = Math.max(0, Math.round(rawRadius));

  for (let row = y; row < y + h; row += 1) {
    for (let column = x; column < x + w; column += 1) {
      if (insideRoundedRect(column, row, x, y, w, h, radius)) {
        setPixel(png, column, row, color);
      }
    }
  }
}

function strokeRoundedRect(png, x, y, w, h, radius, color, thickness) {
  const startX = Math.round(x);
  const startY = Math.round(y);
  const width = Math.round(w);
  const height = Math.round(h);
  const stroke = Math.round(thickness);

  for (let row = startY; row < startY + height; row += 1) {
    for (let column = startX; column < startX + width; column += 1) {
      const inOuter = insideRoundedRect(column, row, startX, startY, width, height, Math.round(radius));
      const inInner = insideRoundedRect(
        column,
        row,
        startX + stroke,
        startY + stroke,
        width - stroke * 2,
        height - stroke * 2,
        Math.max(0, Math.round(radius) - stroke)
      );

      if (inOuter && !inInner) {
        setPixel(png, column, row, color);
      }
    }
  }
}

function insideRoundedRect(column, row, x, y, w, h, radius) {
  if (radius <= 0) {
    return column >= x && column < x + w && row >= y && row < y + h;
  }

  const left = x + radius;
  const right = x + w - radius - 1;
  const top = y + radius;
  const bottom = y + h - radius - 1;

  if ((column >= left && column <= right) || (row >= top && row <= bottom)) {
    return true;
  }

  const cx = column < left ? left : right;
  const cy = row < top ? top : bottom;
  const dx = column - cx;
  const dy = row - cy;
  return dx * dx + dy * dy <= radius * radius;
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
