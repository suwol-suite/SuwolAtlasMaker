import { promises as fs } from "node:fs";
import path from "node:path";

const root = process.cwd();
const unpackedDir = path.join(root, "release", "win-unpacked");

await assertDirectory(unpackedDir, "Windows unpacked output is missing");
await assertFile(path.join(unpackedDir, "Suwol Atlas Maker.exe"), "Windows executable is missing");
await assertDirectory(path.join(unpackedDir, "resources"), "Windows resources directory is missing");
await assertFile(path.join(unpackedDir, "resources", "app.asar"), "Windows app.asar is missing");
await assertFile(path.join(unpackedDir, "resources", "build", "icon.png"), "Packaged icon resource is missing");

console.log(`Windows packaged smoke passed: ${unpackedDir}`);

async function assertDirectory(directory, message) {
  try {
    const stat = await fs.stat(directory);

    if (stat.isDirectory()) {
      return;
    }
  } catch {
    // Fall through to a clear error.
  }

  throw new Error(`${message}: ${directory}`);
}

async function assertFile(filePath, message) {
  try {
    const stat = await fs.stat(filePath);

    if (stat.isFile() && stat.size > 0) {
      return;
    }
  } catch {
    // Fall through to a clear error.
  }

  throw new Error(`${message}: ${filePath}`);
}
