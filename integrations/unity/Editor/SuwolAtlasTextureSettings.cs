using UnityEditor;
using UnityEngine;

namespace Suwol.AtlasMaker.Editor
{
    public static class SuwolAtlasTextureSettings
    {
        public static void ValidateTexture(Texture2D texture, bool requiresReadable, SuwolAtlasValidationReport report)
        {
            if (texture == null)
            {
                report.AddError("Page texture is missing.");
                return;
            }

            string assetPath = AssetDatabase.GetAssetPath(texture);
            TextureImporter importer = AssetImporter.GetAtPath(assetPath) as TextureImporter;

            if (importer == null)
            {
                report.AddWarning("Texture importer was not found for " + texture.name + ".");
                return;
            }

            if (requiresReadable && !importer.isReadable)
            {
                report.AddWarning(texture.name + " should have Read/Write Enabled because the atlas contains rotated sprites.");
            }

            if (importer.wrapMode != TextureWrapMode.Clamp)
            {
                report.AddWarning(texture.name + " uses wrap mode " + importer.wrapMode + "; Clamp is recommended for atlas pages.");
            }

            if (importer.textureCompression != TextureImporterCompression.Uncompressed)
            {
                report.AddInfo(texture.name + " is compressed. Disable compression if exact pixel colors matter.");
            }
        }

        public static void ApplyRecommendedSettings(Texture2D[] textures, bool requireReadable)
        {
            if (textures == null)
            {
                return;
            }

            for (int i = 0; i < textures.Length; i++)
            {
                ApplyRecommendedSettings(textures[i], requireReadable);
            }
        }

        public static void ApplyRecommendedSettings(Texture2D texture, bool requireReadable)
        {
            if (texture == null)
            {
                return;
            }

            string assetPath = AssetDatabase.GetAssetPath(texture);
            TextureImporter importer = AssetImporter.GetAtPath(assetPath) as TextureImporter;

            if (importer == null)
            {
                Debug.LogWarning("Suwol Atlas Maker could not find a TextureImporter for " + texture.name + ".");
                return;
            }

            bool changed = false;

            if (requireReadable && !importer.isReadable)
            {
                importer.isReadable = true;
                changed = true;
            }

            if (importer.wrapMode != TextureWrapMode.Clamp)
            {
                importer.wrapMode = TextureWrapMode.Clamp;
                changed = true;
            }

            if (importer.filterMode != FilterMode.Point)
            {
                importer.filterMode = FilterMode.Point;
                changed = true;
            }

            if (changed)
            {
                EditorUtility.SetDirty(importer);
                importer.SaveAndReimport();
                AssetDatabase.ImportAsset(assetPath, ImportAssetOptions.ForceUpdate);
            }
        }
    }
}
