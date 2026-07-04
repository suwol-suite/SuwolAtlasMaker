import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const localesDir = path.join(rootDir, "src", "shared", "i18n", "locales");
const baseLanguage = "en";

async function main() {
  const locale = process.argv[2];

  if (!locale || !/^[a-z]{2}(?:-[A-Z]{2})?$/.test(locale)) {
    throw new Error("Usage: npm run i18n:add -- <locale>, for example npm run i18n:add -- ja");
  }

  const sourceDir = path.join(localesDir, baseLanguage);
  const targetDir = path.join(localesDir, locale);
  await fs.mkdir(targetDir, { recursive: true });

  const files = (await fs.readdir(sourceDir)).filter((file) => file.endsWith(".json")).sort();

  for (const file of files) {
    const source = JSON.parse(await fs.readFile(path.join(sourceDir, file), "utf8"));
    const targetPath = path.join(targetDir, file);

    try {
      await fs.access(targetPath);
      continue;
    } catch {
      await fs.writeFile(targetPath, `${JSON.stringify(blankStrings(source), null, 2)}\n`, "utf8");
    }
  }

  console.log(`Created hidden locale scaffold: ${path.relative(rootDir, targetDir)}`);
  console.log("Add it to src/shared/i18n/language-registry.ts and set enabled: true when translations are complete.");
}

function blankStrings(value) {
  if (typeof value === "string") {
    return "";
  }

  if (Array.isArray(value)) {
    return value.map((item) => blankStrings(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, blankStrings(child)]));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
