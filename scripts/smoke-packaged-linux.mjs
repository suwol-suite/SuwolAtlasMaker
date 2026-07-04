import { promises as fs } from "node:fs";
import path from "node:path";

const root = process.cwd();
const unpackedDir = path.join(root, "release", "linux-unpacked");

await assertDirectory(unpackedDir, "Linux unpacked output is missing");
await assertDirectory(path.join(unpackedDir, "resources"), "Linux resources directory is missing");
await assertFile(path.join(unpackedDir, "resources", "app.asar"), "Linux app.asar is missing");
await assertFile(path.join(unpackedDir, "resources", "build", "icon.png"), "Packaged icon resource is missing");

const executable = await findExecutable(unpackedDir);
const stat = await fs.stat(executable);

if (process.platform !== "win32" && (stat.mode & 0o111) === 0) {
  throw new Error(`Linux executable does not have execute permission: ${executable}`);
}

console.log(`Linux packaged smoke passed: ${unpackedDir}`);
console.log(`Linux executable: ${executable}`);

async function findExecutable(directory) {
  const candidates = [
    "Suwol Atlas Maker",
    "suwol-atlas-maker",
    "suwol-atlas"
  ];

  for (const candidate of candidates) {
    const filePath = path.join(directory, candidate);

    try {
      const stat = await fs.stat(filePath);

      if (stat.isFile() && stat.size > 0) {
        return filePath;
      }
    } catch {
      // Keep looking.
    }
  }

  throw new Error(`Linux executable was not found in ${directory}.`);
}

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
