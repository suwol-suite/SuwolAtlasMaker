import { promises as fs } from "node:fs";
import path from "node:path";

const root = process.cwd();

const requiredFiles = [
  "integrations/unity/Runtime/SuwolAtlasAsset.cs",
  "integrations/unity/Runtime/SuwolAtlasMetadataData.cs",
  "integrations/unity/Runtime/SuwolAtlasMetadataLoader.cs",
  "integrations/unity/Editor/SuwolAtlasAssetPostprocessor.cs",
  "integrations/unity/Editor/SuwolAtlasPostprocessorSettings.cs",
  "integrations/unity/Editor/SuwolAtlasEditorWindow.cs",
  "integrations/unity/Editor/SuwolAtlasImportUtility.cs",
  "integrations/unity/Editor/SuwolAtlasTextureSettings.cs",
  "integrations/unity/Editor/SuwolAtlasValidationReport.cs",
  "integrations/unity/Editor/Suwol.AtlasMaker.Editor.asmdef"
];

const failures = [];

for (const file of requiredFiles) {
  if (!(await exists(path.join(root, file)))) {
    failures.push(`Missing required Unity integration file: ${file}`);
  }
}

const runtimeDir = path.join(root, "integrations/unity/Runtime");
for (const file of await listFiles(runtimeDir, ".cs")) {
  const text = await fs.readFile(file, "utf8");
  if (text.includes("UnityEditor")) {
    failures.push(`Runtime file must not reference UnityEditor: ${path.relative(root, file)}`);
  }
}

const asmdefPath = path.join(root, "integrations/unity/Editor/Suwol.AtlasMaker.Editor.asmdef");
if (await exists(asmdefPath)) {
  const asmdef = JSON.parse(await fs.readFile(asmdefPath, "utf8"));
  if (!Array.isArray(asmdef.includePlatforms) || !asmdef.includePlatforms.includes("Editor")) {
    failures.push("Unity Editor asmdef must be limited to the Editor platform.");
  }

  if (!Array.isArray(asmdef.references) || !asmdef.references.includes("Suwol.AtlasMaker.Runtime")) {
    failures.push("Unity Editor asmdef must reference Suwol.AtlasMaker.Runtime.");
  }
}

const windowPath = path.join(root, "integrations/unity/Editor/SuwolAtlasEditorWindow.cs");
if (await exists(windowPath)) {
  const windowText = await fs.readFile(windowPath, "utf8");
  if (!windowText.includes("Tools/Suwol Atlas Maker/Open Atlas Viewer")) {
    failures.push("Unity Editor window must expose Tools/Suwol Atlas Maker/Open Atlas Viewer.");
  }

  if (!windowText.includes("Postprocessor Settings")) {
    failures.push("Unity Editor window must link to postprocessor settings.");
  }
}

const settingsPath = path.join(root, "integrations/unity/Editor/SuwolAtlasPostprocessorSettings.cs");
if (await exists(settingsPath)) {
  const settingsText = await fs.readFile(settingsPath, "utf8");
  if (!settingsText.includes("Tools/Suwol Atlas Maker/Postprocessor Settings")) {
    failures.push("Unity postprocessor settings must expose a dedicated menu item.");
  }

  if (!settingsText.includes("enablePostprocessor = false")) {
    failures.push("Unity postprocessor must default to disabled.");
  }
}

const assetPath = path.join(root, "integrations/unity/Runtime/SuwolAtlasAsset.cs");
if (await exists(assetPath)) {
  const assetText = await fs.readFile(assetPath, "utf8");
  if (!assetText.includes("SuwolAtlas Load()")) {
    failures.push("SuwolAtlasAsset must expose Load().");
  }

  if (!assetText.includes("Sprite CreateSprite(string spriteName)")) {
    failures.push("SuwolAtlasAsset must expose CreateSprite(string).");
  }
}

if (failures.length > 0) {
  console.error("Unity integration check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log("Unity integration check passed.");
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(directory, extension) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(entryPath, extension)));
    } else if (entry.name.endsWith(extension)) {
      files.push(entryPath);
    }
  }

  return files;
}
