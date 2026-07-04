import { createWriteStream } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { ZipArchive } from "archiver";
import { getReleasePaths, verifyReleasePackage } from "./verify-release-zip.mjs";

const platform = process.argv[2];

if (platform !== "win" && platform !== "linux") {
  fail('Usage: node scripts/zip-release.mjs <win|linux>');
}

const { archivePath, sourceDir } = await getReleasePaths(platform);

await verifyReleasePackage(platform, { requireArchive: false });
await fs.mkdir(path.dirname(archivePath), { recursive: true });
await fs.rm(archivePath, { force: true });
await zipDirectory(sourceDir, archivePath);
await verifyReleasePackage(platform, { requireArchive: true });

console.log(`ZIP written: ${archivePath}`);
console.log(`ZIP size: ${formatBytes((await fs.stat(archivePath)).size)}`);

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
