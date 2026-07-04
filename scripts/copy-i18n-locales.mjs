import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const sourceDir = path.join(rootDir, "src", "shared", "i18n", "locales");
const targetDir = path.join(rootDir, "dist", "shared", "i18n", "locales");

async function main() {
  await fs.rm(targetDir, { recursive: true, force: true });
  await copyDirectory(sourceDir, targetDir);
  console.log(`Copied i18n locales to ${targetDir}`);
}

async function copyDirectory(source, target) {
  await fs.mkdir(target, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath);
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      await fs.copyFile(sourcePath, targetPath);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
