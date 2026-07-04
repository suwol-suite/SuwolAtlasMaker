using System.IO;
using UnityEditor;
using UnityEngine;

namespace Suwol.AtlasMaker.Editor
{
    public sealed class SuwolAtlasAssetPostprocessor : AssetPostprocessor
    {
        private static bool processing;

        private static void OnPostprocessAllAssets(
            string[] importedAssets,
            string[] deletedAssets,
            string[] movedAssets,
            string[] movedFromAssetPaths)
        {
            if (processing || importedAssets == null)
            {
                return;
            }

            SuwolAtlasPostprocessorSettings settings = SuwolAtlasPostprocessorSettings.Load();

            if (!settings.enablePostprocessor)
            {
                return;
            }

            if (!settings.autoApplyTextureSettings && !settings.autoCreateAtlasAsset)
            {
                return;
            }

            try
            {
                processing = true;

                for (int i = 0; i < importedAssets.Length; i++)
                {
                    ProcessImportedAsset(importedAssets[i], settings);
                }
            }
            finally
            {
                processing = false;
            }
        }

        private static void ProcessImportedAsset(string assetPath, SuwolAtlasPostprocessorSettings settings)
        {
            if (!IsExportAtlasJson(assetPath))
            {
                return;
            }

            TextAsset atlasJson = AssetDatabase.LoadAssetAtPath<TextAsset>(assetPath);

            if (atlasJson == null)
            {
                return;
            }

            SuwolAtlasValidationReport report = new SuwolAtlasValidationReport();
            SuwolAtlasData data = SuwolAtlasImportUtility.ParseAtlasJson(atlasJson, report);
            Texture2D[] pages = SuwolAtlasImportUtility.FindPageTextures(atlasJson, data, report);

            if (data != null)
            {
                SuwolAtlasImportUtility.ValidateData(data, pages, report);
            }

            LogReport(assetPath, report);

            if (!report.IsValid || data == null)
            {
                return;
            }

            if (settings.autoApplyTextureSettings)
            {
                SuwolAtlasTextureSettings.ApplyRecommendedSettings(pages, SuwolAtlasImportUtility.HasRotatedSprites(data));
            }

            if (settings.autoCreateAtlasAsset)
            {
                CreateOrUpdateAtlasAsset(assetPath, atlasJson, pages, data, settings);
            }
        }

        [MenuItem("Tools/Suwol Atlas Maker/Validate Selected Atlas")]
        public static void ValidateSelectedAtlas()
        {
            TextAsset atlasJson = Selection.activeObject as TextAsset;

            if (atlasJson == null)
            {
                Debug.LogWarning("Suwol Atlas Maker validation requires a selected atlas JSON TextAsset.");
                return;
            }

            SuwolAtlasValidationReport report = new SuwolAtlasValidationReport();
            SuwolAtlasData data = SuwolAtlasImportUtility.ParseAtlasJson(atlasJson, report);
            Texture2D[] pages = SuwolAtlasImportUtility.FindPageTextures(atlasJson, data, report);

            if (data != null)
            {
                SuwolAtlasImportUtility.ValidateData(data, pages, report);
            }

            LogReport(AssetDatabase.GetAssetPath(atlasJson), report);
        }

        [MenuItem("Tools/Suwol Atlas Maker/Create Atlas Asset From Selected")]
        public static void CreateAtlasAssetFromSelected()
        {
            TextAsset atlasJson = Selection.activeObject as TextAsset;

            if (atlasJson == null)
            {
                Debug.LogWarning("Suwol Atlas Maker asset creation requires a selected atlas JSON TextAsset.");
                return;
            }

            SuwolAtlasPostprocessorSettings settings = SuwolAtlasPostprocessorSettings.Load();
            SuwolAtlasValidationReport report = new SuwolAtlasValidationReport();
            SuwolAtlasData data = SuwolAtlasImportUtility.ParseAtlasJson(atlasJson, report);
            Texture2D[] pages = SuwolAtlasImportUtility.FindPageTextures(atlasJson, data, report);

            if (data != null)
            {
                SuwolAtlasImportUtility.ValidateData(data, pages, report);
            }

            LogReport(AssetDatabase.GetAssetPath(atlasJson), report);

            if (report.IsValid && data != null)
            {
                CreateOrUpdateAtlasAsset(AssetDatabase.GetAssetPath(atlasJson), atlasJson, pages, data, settings);
            }
        }

        private static bool IsExportAtlasJson(string assetPath)
        {
            if (string.IsNullOrEmpty(assetPath) || !assetPath.EndsWith(".json"))
            {
                return false;
            }

            if (!File.Exists(assetPath))
            {
                return false;
            }

            string text = File.ReadAllText(assetPath);

            if (LooksLikeProjectFile(text))
            {
                return false;
            }

            return text.Contains("\"version\"") &&
                text.Contains("\"pages\"") &&
                text.Contains("\"sprites\"");
        }

        private static bool LooksLikeProjectFile(string json)
        {
            return json.Contains("\"inputDir\"") &&
                json.Contains("\"outputDir\"") &&
                json.Contains("\"options\"") &&
                json.Contains("\"profile\"");
        }

        private static void CreateOrUpdateAtlasAsset(
            string jsonAssetPath,
            TextAsset atlasJson,
            Texture2D[] pages,
            SuwolAtlasData data,
            SuwolAtlasPostprocessorSettings settings)
        {
            string folder = Path.GetDirectoryName(jsonAssetPath);
            string assetName = !string.IsNullOrEmpty(data.name) ? data.name : Path.GetFileNameWithoutExtension(jsonAssetPath);
            string suffix = string.IsNullOrEmpty(settings.generatedAssetSuffix) ? ".suwol-atlas.asset" : settings.generatedAssetSuffix;

            if (!suffix.EndsWith(".asset"))
            {
                suffix += ".asset";
            }

            if (!string.IsNullOrEmpty(settings.generatedAssetDirectory))
            {
                folder = settings.generatedAssetDirectory;
            }

            string outputPath = Path.Combine(folder, assetName + suffix).Replace("\\", "/");
            SuwolAtlasAsset asset = AssetDatabase.LoadAssetAtPath<SuwolAtlasAsset>(outputPath);

            if (asset == null)
            {
                asset = ScriptableObject.CreateInstance<SuwolAtlasAsset>();
                asset.SetSource(atlasJson, pages, Mathf.Max(1f, settings.pixelsPerUnit));
                Directory.CreateDirectory(Path.GetDirectoryName(outputPath));
                AssetDatabase.CreateAsset(asset, outputPath);
                LogInfo(settings, "Suwol Atlas Maker created atlas asset: " + outputPath);
            }
            else
            {
                asset.SetSource(atlasJson, pages, Mathf.Max(1f, settings.pixelsPerUnit));
                EditorUtility.SetDirty(asset);
                LogInfo(settings, "Suwol Atlas Maker updated atlas asset: " + outputPath);
            }

            AssetDatabase.SaveAssets();
        }

        private static void LogReport(string assetPath, SuwolAtlasValidationReport report)
        {
            for (int i = 0; i < report.Errors.Count; i++)
            {
                Debug.LogError("Suwol Atlas Maker import error in " + assetPath + ": " + report.Errors[i]);
            }

            for (int i = 0; i < report.Warnings.Count; i++)
            {
                Debug.LogWarning("Suwol Atlas Maker import warning in " + assetPath + ": " + report.Warnings[i]);
            }

            for (int i = 0; i < report.Infos.Count; i++)
            {
                Debug.Log("Suwol Atlas Maker import: " + report.Infos[i]);
            }
        }

        private static void LogInfo(SuwolAtlasPostprocessorSettings settings, string message)
        {
            if (settings != null && settings.logVerbose)
            {
                Debug.Log(message);
            }
        }
    }
}
