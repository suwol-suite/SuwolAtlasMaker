import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const localesDir = path.join(rootDir, "src", "shared", "i18n", "locales");
const registryPath = path.join(rootDir, "src", "shared", "i18n", "language-registry.ts");
const typesPath = path.join(rootDir, "src", "shared", "i18n", "types.ts");
const baseLanguage = "en";

async function main() {
  const registry = await readLanguageRegistry();
  const namespaces = await readNamespaceList();
  const enabledLanguages = registry
    .filter((entry) => entry.enabled && entry.id !== "system")
    .map((entry) => entry.id);
  const registeredLanguages = new Set(registry.map((entry) => entry.id));
  const errors = [];
  const warnings = [];

  if (!enabledLanguages.includes(baseLanguage)) {
    errors.push(`Base language ${baseLanguage} must be enabled in language-registry.ts.`);
  }

  const localeDirectories = await listLocaleDirectories();

  for (const directory of localeDirectories) {
    if (!registeredLanguages.has(directory)) {
      warnings.push(`${directory} locale folder exists but is not registered.`);
    }
  }

  const requiredNamespaceFiles = namespaces.map((namespace) => `${namespace}.json`).sort();
  const languageFiles = new Map();

  for (const language of enabledLanguages) {
    const directory = path.join(localesDir, language);

    if (!localeDirectories.includes(language)) {
      errors.push(`Enabled language ${language} is missing locale directory.`);
      continue;
    }

    const entries = await fs.readdir(directory);
    const files = entries.filter((entry) => entry.endsWith(".json")).sort();
    languageFiles.set(language, files);

    for (const file of requiredNamespaceFiles) {
      if (!files.includes(file)) {
        errors.push(`${language} is missing namespace ${file}`);
      }
    }

    for (const file of files) {
      if (!requiredNamespaceFiles.includes(file)) {
        errors.push(`${language} has extra namespace ${file}`);
      }
    }
  }

  if (!languageFiles.has(baseLanguage)) {
    throwCheckError(errors, warnings);
  }

  for (const file of requiredNamespaceFiles) {
    const base = await readJson(baseLanguage, file);
    assertNoEmptyStrings(base, `${baseLanguage}/${file}`, errors);

    for (const language of enabledLanguages.filter((entry) => entry !== baseLanguage)) {
      if (!languageFiles.get(language)?.includes(file)) {
        continue;
      }

      const compare = await readJson(language, file);
      assertNoEmptyStrings(compare, `${language}/${file}`, errors);
      compareKeys(base, compare, `${baseLanguage}/${file}`, `${language}/${file}`, errors);
    }
  }

  throwCheckError(errors, warnings);

  for (const warning of warnings) {
    console.warn(`i18n warning: ${warning}`);
  }

  console.log(`i18n check passed for enabled locales: ${enabledLanguages.join(", ")}.`);
}

async function readLanguageRegistry() {
  const source = await fs.readFile(registryPath, "utf8");
  const entries = [...source.matchAll(/\{\s*id:\s*"([^"]+)"[\s\S]*?enabled:\s*(true|false)\s*\}/g)]
    .map((match) => ({
      id: match[1],
      enabled: match[2] === "true"
    }));

  if (entries.length === 0) {
    throw new Error("No language options found in language-registry.ts.");
  }

  return entries;
}

async function readNamespaceList() {
  const source = await fs.readFile(typesPath, "utf8");
  const match = /I18N_NAMESPACES\s*=\s*\[([\s\S]*?)\]\s*as const/.exec(source);

  if (!match) {
    throw new Error("I18N_NAMESPACES could not be found in types.ts.");
  }

  const namespaces = [...match[1].matchAll(/"([^"]+)"/g)].map((entry) => entry[1]);

  if (namespaces.length === 0) {
    throw new Error("I18N_NAMESPACES is empty.");
  }

  return namespaces;
}

async function listLocaleDirectories() {
  const entries = await fs.readdir(localesDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

async function readJson(language, file) {
  const fullPath = path.join(localesDir, language, file);

  try {
    return JSON.parse(await fs.readFile(fullPath, "utf8"));
  } catch (error) {
    throw new Error(`Failed to parse ${language}/${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function compareKeys(base, compare, baseLabel, compareLabel, errors, prefix = "") {
  const baseKeys = Object.keys(base).sort();
  const compareKeysList = Object.keys(compare).sort();

  for (const key of baseKeys) {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;

    if (!compareKeysList.includes(key)) {
      errors.push(`${compareLabel} is missing key ${nextPrefix}`);
      continue;
    }

    const baseValue = base[key];
    const compareValue = compare[key];
    const baseIsObject = isPlainObject(baseValue);
    const compareIsObject = isPlainObject(compareValue);

    if (baseIsObject !== compareIsObject) {
      errors.push(`${compareLabel} key ${nextPrefix} has a different shape than ${baseLabel}`);
      continue;
    }

    if (baseIsObject && compareIsObject) {
      compareKeys(baseValue, compareValue, baseLabel, compareLabel, errors, nextPrefix);
    }
  }

  for (const key of compareKeysList) {
    if (!baseKeys.includes(key)) {
      errors.push(`${compareLabel} has extra key ${prefix ? `${prefix}.` : ""}${key}`);
    }
  }
}

function assertNoEmptyStrings(value, label, errors, prefix = "") {
  if (typeof value === "string") {
    if (value.trim().length === 0) {
      errors.push(`${label} has an empty string at ${prefix}`);
    }
    return;
  }

  if (!isPlainObject(value)) {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    assertNoEmptyStrings(child, label, errors, prefix ? `${prefix}.${key}` : key);
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function throwCheckError(errors, warnings) {
  if (errors.length === 0) {
    return;
  }

  const warningText = warnings.length > 0
    ? `\nWarnings:\n${warnings.map((warning) => `- ${warning}`).join("\n")}`
    : "";

  throw new Error(`i18n check failed:\n${errors.map((error) => `- ${error}`).join("\n")}${warningText}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
