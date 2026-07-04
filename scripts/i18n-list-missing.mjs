import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const localesDir = path.join(rootDir, "src", "shared", "i18n", "locales");
const baseLanguage = "en";

async function main() {
  const languages = await listLocaleDirectories();
  const baseFiles = await listNamespaceFiles(baseLanguage);
  const missing = [];

  for (const language of languages.filter((entry) => entry !== baseLanguage)) {
    const files = await listNamespaceFiles(language);

    for (const file of baseFiles) {
      if (!files.includes(file)) {
        missing.push(`${language} missing namespace ${file}`);
        continue;
      }

      const base = JSON.parse(await fs.readFile(path.join(localesDir, baseLanguage, file), "utf8"));
      const compare = JSON.parse(await fs.readFile(path.join(localesDir, language, file), "utf8"));
      const baseKeys = flattenKeys(base);
      const compareKeys = flattenKeys(compare);

      for (const key of baseKeys) {
        if (!compareKeys.includes(key)) {
          missing.push(`${language}/${file} missing key ${key}`);
        }
      }
    }
  }

  if (missing.length === 0) {
    console.log("No missing i18n keys found.");
    return;
  }

  console.log(missing.map((item) => `- ${item}`).join("\n"));
  process.exitCode = 1;
}

async function listLocaleDirectories() {
  const entries = await fs.readdir(localesDir, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
}

async function listNamespaceFiles(language) {
  const entries = await fs.readdir(path.join(localesDir, language));
  return entries.filter((entry) => entry.endsWith(".json")).sort();
}

function flattenKeys(value, prefix = "") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }

  return Object.entries(value)
    .flatMap(([key, child]) => flattenKeys(child, prefix ? `${prefix}.${key}` : key))
    .sort();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
