using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEngine;

namespace Suwol.AtlasMaker.Editor
{
    public static class SuwolAtlasImportUtility
    {
        public static SuwolAtlasData ParseAtlasJson(TextAsset atlasJson, SuwolAtlasValidationReport report)
        {
            if (atlasJson == null)
            {
                report.AddError("Atlas JSON TextAsset is not assigned.");
                return null;
            }

            if (string.IsNullOrEmpty(atlasJson.text))
            {
                report.AddError("Atlas JSON TextAsset is empty.");
                return null;
            }

            if (LooksLikeProjectFile(atlasJson.text))
            {
                report.AddError("Selected JSON looks like a .suwol-atlas.json project file, not an atlas export JSON. Select the exported {name}.json file.");
                return null;
            }

            SuwolAtlasData data = JsonUtility.FromJson<SuwolAtlasData>(atlasJson.text);

            if (data == null)
            {
                report.AddError("Failed to parse atlas JSON.");
                return null;
            }

            return data;
        }

        public static Texture2D[] FindPageTextures(TextAsset atlasJson, SuwolAtlasData data, SuwolAtlasValidationReport report)
        {
            if (atlasJson == null || data == null || data.pages == null)
            {
                return new Texture2D[0];
            }

            string jsonPath = AssetDatabase.GetAssetPath(atlasJson);
            string jsonDirectory = Path.GetDirectoryName(jsonPath);
            Texture2D[] textures = new Texture2D[data.pages.Length];

            for (int i = 0; i < data.pages.Length; i++)
            {
                SuwolAtlasPage page = data.pages[i];

                if (page == null || string.IsNullOrEmpty(page.image))
                {
                    report.AddWarning("Cannot find texture for page " + i + " because its image name is empty.");
                    continue;
                }

                string texturePath = string.IsNullOrEmpty(jsonDirectory)
                    ? page.image
                    : Path.Combine(jsonDirectory, page.image).Replace("\\", "/");
                textures[i] = AssetDatabase.LoadAssetAtPath<Texture2D>(texturePath);

                if (textures[i] == null)
                {
                    report.AddWarning("Could not find page texture asset at " + texturePath + ".");
                }
            }

            return textures;
        }

        public static SuwolAtlasValidationReport Validate(TextAsset atlasJson, Texture2D[] pageTextures)
        {
            SuwolAtlasValidationReport report = new SuwolAtlasValidationReport();
            SuwolAtlasData data = ParseAtlasJson(atlasJson, report);

            if (data == null)
            {
                return report;
            }

            ValidateData(data, pageTextures, report);
            return report;
        }

        public static bool HasRotatedSprites(SuwolAtlasData data)
        {
            if (data == null || data.sprites == null)
            {
                return false;
            }

            for (int i = 0; i < data.sprites.Length; i++)
            {
                if (data.sprites[i] != null && data.sprites[i].rotated)
                {
                    return true;
                }
            }

            return false;
        }

        public static void ValidateData(SuwolAtlasData data, Texture2D[] pageTextures, SuwolAtlasValidationReport report)
        {
            if (data.version != 1)
            {
                report.AddError("Unsupported atlas JSON version: " + data.version + ".");
            }

            if (data.pages == null || data.pages.Length == 0)
            {
                report.AddError("Atlas JSON must contain at least one page.");
                return;
            }

            if (data.sprites == null)
            {
                report.AddError("Atlas JSON sprites array is missing.");
                return;
            }

            if (pageTextures == null)
            {
                report.AddError("Page texture array is not assigned.");
                return;
            }

            if (pageTextures.Length != data.pages.Length)
            {
                report.AddError("Page texture count does not match JSON page count. JSON pages: " + data.pages.Length + ", textures: " + pageTextures.Length + ".");
            }

            bool rotated = HasRotatedSprites(data);

            for (int i = 0; i < data.pages.Length; i++)
            {
                ValidatePage(data.pages[i], i, pageTextures, rotated, report);
            }

            HashSet<string> names = new HashSet<string>();

            for (int i = 0; i < data.sprites.Length; i++)
            {
                ValidateSprite(data.sprites[i], i, data.pages, names, report);
            }

            report.AddInfo("Validated " + data.sprites.Length + " sprite(s) on " + data.pages.Length + " page(s).");
        }

        private static void ValidatePage(SuwolAtlasPage page, int index, Texture2D[] pageTextures, bool rotatedSpritesExist, SuwolAtlasValidationReport report)
        {
            if (page == null)
            {
                report.AddError("JSON page entry is null at index " + index + ".");
                return;
            }

            if (string.IsNullOrEmpty(page.image))
            {
                report.AddError("JSON page image is empty at index " + index + ".");
            }

            if (page.width <= 0 || page.height <= 0)
            {
                report.AddError("JSON page size must be positive at index " + index + ".");
            }

            if (pageTextures == null || index >= pageTextures.Length)
            {
                return;
            }

            Texture2D texture = pageTextures[index];

            if (texture == null)
            {
                report.AddError("Missing Texture2D for page " + index + " (" + page.image + ").");
                return;
            }

            if (texture.width != page.width || texture.height != page.height)
            {
                report.AddError("Texture size does not match page '" + page.image + "'. JSON: " + page.width + "x" + page.height + ", texture: " + texture.width + "x" + texture.height + ".");
            }

            SuwolAtlasTextureSettings.ValidateTexture(texture, rotatedSpritesExist, report);
        }

        private static void ValidateSprite(SuwolAtlasSprite sprite, int index, SuwolAtlasPage[] pages, HashSet<string> names, SuwolAtlasValidationReport report)
        {
            if (sprite == null)
            {
                report.AddError("JSON sprite entry is null at index " + index + ".");
                return;
            }

            if (string.IsNullOrEmpty(sprite.name))
            {
                report.AddError("Sprite name is empty at index " + index + ".");
                return;
            }

            if (!names.Add(sprite.name))
            {
                report.AddError("Duplicate sprite name: " + sprite.name + ".");
            }

            if (sprite.page < 0 || sprite.page >= pages.Length)
            {
                report.AddError("Sprite '" + sprite.name + "' references invalid page index " + sprite.page + ".");
                return;
            }

            if (sprite.w <= 0 || sprite.h <= 0 || sprite.sourceW <= 0 || sprite.sourceH <= 0)
            {
                report.AddError("Sprite '" + sprite.name + "' has invalid dimensions.");
            }

            SuwolAtlasPage page = pages[sprite.page];

            if (page != null && (sprite.x < 0 || sprite.y < 0 || sprite.x + sprite.w > page.width || sprite.y + sprite.h > page.height))
            {
                report.AddError("Sprite '" + sprite.name + "' rect is outside page '" + page.image + "'.");
            }

            if (sprite.trimmed)
            {
                report.AddInfo("Sprite '" + sprite.name + "' is trimmed. Offset: " + sprite.offsetX + "," + sprite.offsetY + ".");
            }
        }

        private static bool LooksLikeProjectFile(string json)
        {
            return json.Contains("\"inputDir\"") &&
                json.Contains("\"outputDir\"") &&
                json.Contains("\"options\"") &&
                json.Contains("\"profile\"");
        }
    }
}
