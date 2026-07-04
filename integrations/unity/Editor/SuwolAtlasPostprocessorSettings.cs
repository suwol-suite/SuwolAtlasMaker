using UnityEditor;
using UnityEngine;

namespace Suwol.AtlasMaker.Editor
{
    public sealed class SuwolAtlasPostprocessorSettings : ScriptableObject
    {
        private const string SettingsAssetPath = "Assets/SuwolAtlasPostprocessorSettings.asset";

        public bool enablePostprocessor;
        public bool autoApplyTextureSettings;
        public bool autoCreateAtlasAsset;
        public bool logVerbose;
        public float pixelsPerUnit = 100f;
        public string generatedAssetSuffix = ".suwol-atlas.asset";
        public string generatedAssetDirectory = "";

        public static SuwolAtlasPostprocessorSettings Load()
        {
            SuwolAtlasPostprocessorSettings settings = AssetDatabase.LoadAssetAtPath<SuwolAtlasPostprocessorSettings>(SettingsAssetPath);

            if (settings != null)
            {
                return settings;
            }

            settings = CreateInstance<SuwolAtlasPostprocessorSettings>();
            settings.enablePostprocessor = false;
            settings.autoApplyTextureSettings = false;
            settings.autoCreateAtlasAsset = false;
            settings.logVerbose = false;
            settings.pixelsPerUnit = 100f;
            settings.generatedAssetSuffix = ".suwol-atlas.asset";
            settings.generatedAssetDirectory = "";
            return settings;
        }

        [MenuItem("Tools/Suwol Atlas Maker/Postprocessor Settings")]
        public static void OpenPostprocessorSettings()
        {
            SuwolAtlasPostprocessorSettings settings = AssetDatabase.LoadAssetAtPath<SuwolAtlasPostprocessorSettings>(SettingsAssetPath);

            if (settings == null)
            {
                settings = CreateInstance<SuwolAtlasPostprocessorSettings>();
                AssetDatabase.CreateAsset(settings, SettingsAssetPath);
                AssetDatabase.SaveAssets();
            }

            Selection.activeObject = settings;
            EditorGUIUtility.PingObject(settings);
        }

        [MenuItem("Tools/Suwol Atlas Maker/Settings")]
        public static void OpenSettings()
        {
            OpenPostprocessorSettings();
        }
    }
}
