import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import asar from "@electron/asar";

const root = process.cwd();
const releaseDir = path.join(root, "release");
const forbiddenTopLevelEntries = new Set([
  ".github",
  "docs",
  "integrations",
  "release",
  "samples",
  "scripts",
  "src",
  "tests"
]);

const requiredAsarFiles = [
  "dist/electron/main.js",
  "dist/electron/preload.cjs",
  "dist/renderer/index.html",
  "package.json"
];

const requiredAsarDirectories = [
  "dist/core",
  "dist/shared",
  "dist/renderer/assets"
];

export async function getReleasePaths(platform) {
  assertPlatform(platform);

  const manifest = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
  const version = manifest.version;
  const unpackedName = platform === "win" ? "win-unpacked" : "linux-unpacked";
  const archiveName = `SuwolAtlasMaker-${version}-${platform}-x64.zip`;

  return {
    archiveName,
    archivePath: path.join(releaseDir, "archives", archiveName),
    releaseDir,
    sourceDir: path.join(releaseDir, unpackedName),
    version
  };
}

export async function verifyReleasePackage(platform, options = {}) {
  const requireArchive = options.requireArchive ?? true;
  const paths = await getReleasePaths(platform);

  await verifyUnpackedDirectory(platform, paths.sourceDir);

  let zipEntries = [];

  if (requireArchive) {
    await assertFile(paths.archivePath, "Release ZIP is missing");
    const stat = await fs.stat(paths.archivePath);

    if (stat.size <= 0) {
      throw new Error(`Release ZIP is empty: ${paths.archivePath}`);
    }

    zipEntries = await listZipEntries(paths.archivePath);
    assertNoForbiddenTopLevelEntries(zipEntries, "release ZIP");
    assertZipContainsRuntimeFiles(platform, zipEntries);
  }

  return {
    ...paths,
    zipEntries
  };
}

async function verifyUnpackedDirectory(platform, sourceDir) {
  await assertDirectory(sourceDir, "Unpacked app output is missing");

  const rootEntries = await fs.readdir(sourceDir);

  if (rootEntries.length === 0) {
    throw new Error(`Unpacked app output is empty: ${sourceDir}`);
  }

  assertNoForbiddenTopLevelEntries(rootEntries, "unpacked app");

  const resourcesDir = path.join(sourceDir, "resources");
  const appAsarPath = path.join(resourcesDir, "app.asar");

  await assertDirectory(resourcesDir, "Electron resources directory is missing");
  await assertFile(appAsarPath, "Packaged app.asar is missing");
  await assertFile(path.join(resourcesDir, "build", "icon.png"), "Packaged icon resource is missing");

  if (platform === "win") {
    await assertFile(path.join(sourceDir, "Suwol Atlas Maker.exe"), "Windows executable is missing");
  } else {
    const executable = await findLinuxExecutable(sourceDir);
    await assertExecutable(executable);
  }

  const asarEntries = asar.listPackage(appAsarPath, {}).map(normalizeEntry);
  assertNoForbiddenTopLevelEntries(asarEntries, "app.asar");
  assertAsarContainsRuntimeFiles(asarEntries);
  assertRendererAssetReferencesAreRelative(appAsarPath);
}

function assertZipContainsRuntimeFiles(platform, entries) {
  const requiredFiles = [
    "resources/app.asar",
    "resources/build/icon.png"
  ];

  if (platform === "win") {
    requiredFiles.push("Suwol Atlas Maker.exe");
  } else if (!entries.some((entry) => [
    "Suwol Atlas Maker",
    "suwol-atlas-maker",
    "suwol-atlas"
  ].includes(entry))) {
    throw new Error("Linux executable is missing from release ZIP.");
  }

  for (const file of requiredFiles) {
    if (!entries.includes(file)) {
      throw new Error(`Required runtime file is missing from release ZIP: ${file}`);
    }
  }
}

function assertAsarContainsRuntimeFiles(entries) {
  for (const file of requiredAsarFiles) {
    if (!entries.includes(file)) {
      throw new Error(`Required runtime file is missing from app.asar: ${file}`);
    }
  }

  for (const directory of requiredAsarDirectories) {
    if (!entries.some((entry) => entry === directory || entry.startsWith(`${directory}/`))) {
      throw new Error(`Required runtime directory is missing from app.asar: ${directory}`);
    }
  }
}

function assertRendererAssetReferencesAreRelative(appAsarPath) {
  const indexHtml = extractAsarText(appAsarPath, "dist/renderer/index.html");

  if (/(?:src|href)="\/assets\//.test(indexHtml)) {
    throw new Error("Renderer asset URLs must be relative for packaged file:// loading.");
  }

  if (!/(?:src|href)="\.\/assets\//.test(indexHtml)) {
    throw new Error("Renderer index.html does not reference packaged renderer assets with relative URLs.");
  }
}

function extractAsarText(appAsarPath, filePath) {
  const candidates = [
    filePath,
    filePath.replace(/\//g, "\\")
  ];

  for (const candidate of candidates) {
    try {
      return asar.extractFile(appAsarPath, candidate).toString("utf8");
    } catch {
      // Try the next path separator style.
    }
  }

  throw new Error(`Required app.asar file could not be extracted: ${filePath}`);
}

function assertNoForbiddenTopLevelEntries(entries, label) {
  for (const rawEntry of entries) {
    const entry = normalizeEntry(rawEntry);

    if (!entry) {
      continue;
    }

    const topLevel = entry.split("/")[0];

    if (forbiddenTopLevelEntries.has(topLevel)) {
      throw new Error(`Forbidden ${label} entry found: ${entry}`);
    }
  }
}

async function listZipEntries(zipPath) {
  const buffer = await fs.readFile(zipPath);
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);

  if (totalEntries === 0xffff || centralDirectoryOffset === 0xffffffff) {
    throw new Error("ZIP64 archives are not supported by this verifier.");
  }

  const entries = [];
  let offset = centralDirectoryOffset;

  for (let index = 0; index < totalEntries; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error(`Invalid ZIP central directory at offset ${offset}.`);
    }

    const flags = buffer.readUInt16LE(offset + 8);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const fileNameStart = offset + 46;
    const fileNameEnd = fileNameStart + fileNameLength;
    const encoding = (flags & 0x800) !== 0 ? "utf8" : "latin1";

    entries.push(normalizeEntry(buffer.toString(encoding, fileNameStart, fileNameEnd)));
    offset = fileNameEnd + extraLength + commentLength;
  }

  return entries;
}

function findEndOfCentralDirectory(buffer) {
  const minimumOffset = Math.max(0, buffer.length - 22 - 0xffff);

  for (let offset = buffer.length - 22; offset >= minimumOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      return offset;
    }
  }

  throw new Error("ZIP end of central directory record was not found.");
}

async function findLinuxExecutable(directory) {
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

async function assertExecutable(filePath) {
  const stat = await fs.stat(filePath);

  if (!stat.isFile() || stat.size <= 0) {
    throw new Error(`Expected executable file: ${filePath}`);
  }

  if (process.platform !== "win32" && (stat.mode & 0o111) === 0) {
    throw new Error(`Linux executable does not have execute permission: ${filePath}`);
  }
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

function assertPlatform(platform) {
  if (platform !== "win" && platform !== "linux") {
    throw new Error("Usage: node scripts/verify-release-zip.mjs <win|linux>");
  }
}

function normalizeEntry(entry) {
  return entry.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
}

function isDirectRun() {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isDirectRun()) {
  try {
    const platform = process.argv[2];
    const result = await verifyReleasePackage(platform, { requireArchive: true });

    console.log(`Release ZIP verification passed: ${result.archivePath}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
