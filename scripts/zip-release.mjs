import { createWriteStream } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { ZipArchive } from "archiver";

const platform = process.argv[2];
const root = process.cwd();
const releaseDir = path.join(root, "release");
const archivesDir = path.join(releaseDir, "archives");

if (platform !== "win" && platform !== "linux") {
  fail('Usage: node scripts/zip-release.mjs <win|linux>');
}

const manifest = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
const version = manifest.version;
const archiveName = `SuwolAtlasMaker-${version}-${platform}-x64.zip`;
const sourceDir = await findUnpackedDirectory(platform);
const archivePath = path.join(archivesDir, archiveName);

await validateUnpackedDirectory(platform, sourceDir);
await fs.mkdir(archivesDir, { recursive: true });
await fs.rm(archivePath, { force: true });
await zipDirectory(sourceDir, archivePath);

const stat = await fs.stat(archivePath);

if (stat.size <= 0) {
  fail(`ZIP archive is empty: ${archivePath}`);
}

console.log(`ZIP written: ${archivePath}`);
console.log(`ZIP size: ${formatBytes(stat.size)}`);

async function findUnpackedDirectory(targetPlatform) {
  const candidates = targetPlatform === "win"
    ? ["win-unpacked"]
    : ["linux-unpacked"];

  for (const candidate of candidates) {
    const directory = path.join(releaseDir, candidate);

    try {
      const stat = await fs.stat(directory);

      if (stat.isDirectory()) {
        return directory;
      }
    } catch {
      // Try the next candidate before reporting a clear error.
    }
  }

  fail(`Missing ${targetPlatform} unpacked output under ${releaseDir}. Run npm run pack:${targetPlatform} first.`);
}

async function validateUnpackedDirectory(targetPlatform, directory) {
  const entries = await fs.readdir(directory);

  if (entries.length === 0) {
    fail(`Unpacked output is empty: ${directory}`);
  }

  const resourcesDir = path.join(directory, "resources");

  await assertExists(resourcesDir, "Electron resources directory is missing");
  await assertExists(path.join(resourcesDir, "app.asar"), "Packaged app.asar is missing");

  if (targetPlatform === "win") {
    await assertExists(path.join(directory, "Suwol Atlas Maker.exe"), "Windows executable is missing");
  } else {
    const executable = await findLinuxExecutable(directory);
    await assertExecutable(executable);
  }
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

      if (stat.isFile()) {
        return filePath;
      }
    } catch {
      // Keep looking.
    }
  }

  fail(`Linux executable was not found in ${directory}.`);
}

async function assertExecutable(filePath) {
  const stat = await fs.stat(filePath);

  if (!stat.isFile()) {
    fail(`Expected executable file: ${filePath}`);
  }

  if (process.platform !== "win32" && (stat.mode & 0o111) === 0) {
    fail(`Linux executable does not have execute permission: ${filePath}`);
  }
}

async function assertExists(filePath, message) {
  try {
    await fs.access(filePath);
  } catch {
    fail(`${message}: ${filePath}`);
  }
}

async function zipDirectory(source, destination) {
  await new Promise((resolve, reject) => {
    const output = createWriteStream(destination);
    const archive = new ZipArchive({ zlib: { level: 9 } });

    output.on("close", resolve);
    output.on("error", reject);
    archive.on("warning", reject);
    archive.on("error", reject);

    archive.pipe(output);
    archive.directory(source, false);
    void archive.finalize();
  });
}

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kib = bytes / 1024;

  if (kib < 1024) {
    return `${kib.toFixed(1)} KiB`;
  }

  return `${(kib / 1024).toFixed(1)} MiB`;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
