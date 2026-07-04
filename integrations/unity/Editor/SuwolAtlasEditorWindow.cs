using System.IO;
using UnityEditor;
using UnityEngine;

namespace Suwol.AtlasMaker.Editor
{
    public sealed class SuwolAtlasEditorWindow : EditorWindow
    {
        private TextAsset atlasJson;
        private TextAsset metadataJson;
        private Texture2D[] pages = new Texture2D[0];
        private SuwolAtlasData data;
        private SuwolAtlasMetadata metadata;
        private SuwolAtlasValidationReport report = new SuwolAtlasValidationReport();
        private Vector2 spriteScroll;
        private Vector2 reportScroll;
        private int selectedSpriteIndex;
        private int reportSeverityFilter;
        private string spriteSearch = "";
        private float pixelsPerUnit = 100f;

        [MenuItem("Tools/Suwol Atlas Maker/Open Atlas Viewer")]
        public static void Open()
        {
            GetWindow<SuwolAtlasEditorWindow>("Suwol Atlas Maker");
        }

        private void OnGUI()
        {
            EditorGUILayout.LabelField("Suwol Atlas Maker Atlas Viewer", EditorStyles.boldLabel);
            EditorGUILayout.Space();

            EditorGUI.BeginChangeCheck();
            atlasJson = (TextAsset)EditorGUILayout.ObjectField("Atlas JSON", atlasJson, typeof(TextAsset), false);
            metadataJson = (TextAsset)EditorGUILayout.ObjectField("Metadata JSON", metadataJson, typeof(TextAsset), false);

            if (EditorGUI.EndChangeCheck())
            {
                LoadJsonAndFindPages();
            }

            using (new EditorGUILayout.HorizontalScope())
            {
                if (GUILayout.Button("Find Page Textures"))
                {
                    LoadJsonAndFindPages();
                }

                if (GUILayout.Button("Validate"))
                {
                    ValidateCurrent();
                }

                if (GUILayout.Button("Apply Recommended Settings"))
                {
                    SuwolAtlasTextureSettings.ApplyRecommendedSettings(pages, SuwolAtlasImportUtility.HasRotatedSprites(data));
                    ValidateCurrent();
                }

                if (GUILayout.Button("Postprocessor Settings"))
                {
                    SuwolAtlasPostprocessorSettings.OpenPostprocessorSettings();
                }
            }

            DrawPageFields();
            DrawValidation();
            DrawSprites();
            DrawAssetCreator();
        }

        private void LoadJsonAndFindPages()
        {
            report = new SuwolAtlasValidationReport();
            data = SuwolAtlasImportUtility.ParseAtlasJson(atlasJson, report);
            pages = SuwolAtlasImportUtility.FindPageTextures(atlasJson, data, report);
            LoadMetadata();
            selectedSpriteIndex = 0;
            ValidateCurrent();
        }

        private void ValidateCurrent()
        {
            report = SuwolAtlasImportUtility.Validate(atlasJson, pages);
            LoadMetadata();
        }

        private void LoadMetadata()
        {
            metadata = null;

            if (metadataJson == null)
            {
                return;
            }

            try
            {
                metadata = SuwolAtlasMetadataLoader.Load(metadataJson);
            }
            catch (System.Exception error)
            {
                report.AddWarning("Metadata sidecar could not be loaded: " + error.Message);
            }
        }

        private void DrawPageFields()
        {
            EditorGUILayout.Space();
            EditorGUILayout.LabelField("Pages", EditorStyles.boldLabel);

            int pageCount = data != null && data.pages != null ? data.pages.Length : pages.Length;

            if (pages == null || pages.Length != pageCount)
            {
                Texture2D[] next = new Texture2D[pageCount];

                if (pages != null)
                {
                    for (int i = 0; i < Mathf.Min(pages.Length, next.Length); i++)
                    {
                        next[i] = pages[i];
                    }
                }

                pages = next;
            }

            for (int i = 0; i < pages.Length; i++)
            {
                string label = data != null && data.pages != null && i < data.pages.Length && data.pages[i] != null
                    ? "Page " + i + " - " + data.pages[i].image
                    : "Page " + i;
                pages[i] = (Texture2D)EditorGUILayout.ObjectField(label, pages[i], typeof(Texture2D), false);

                if (pages[i] != null)
                {
                    EditorGUILayout.LabelField("Texture Status", pages[i].width + "x" + pages[i].height + " at " + AssetDatabase.GetAssetPath(pages[i]));
                }
            }
        }

        private void DrawValidation()
        {
            EditorGUILayout.Space();
            EditorGUILayout.LabelField("Validation", EditorStyles.boldLabel);
            reportSeverityFilter = GUILayout.Toolbar(reportSeverityFilter, new string[] { "All", "Errors", "Warnings", "Info" });
            reportScroll = EditorGUILayout.BeginScrollView(reportScroll, GUILayout.MinHeight(92), GUILayout.MaxHeight(160));

            if (reportSeverityFilter == 0 || reportSeverityFilter == 1)
            {
                DrawMessages("Errors", report.Errors, MessageType.Error);
            }

            if (reportSeverityFilter == 0 || reportSeverityFilter == 2)
            {
                DrawMessages("Warnings", report.Warnings, MessageType.Warning);
            }

            if (reportSeverityFilter == 0 || reportSeverityFilter == 3)
            {
                DrawMessages("Info", report.Infos, MessageType.Info);
            }

            EditorGUILayout.EndScrollView();
        }

        private void DrawSprites()
        {
            if (data == null || data.sprites == null)
            {
                return;
            }

            EditorGUILayout.Space();
            EditorGUILayout.LabelField("Sprites", EditorStyles.boldLabel);
            spriteSearch = EditorGUILayout.TextField("Search", spriteSearch);

            using (new EditorGUILayout.HorizontalScope())
            {
                spriteScroll = EditorGUILayout.BeginScrollView(spriteScroll, GUILayout.Width(240), GUILayout.MinHeight(220));

                for (int i = 0; i < data.sprites.Length; i++)
                {
                    SuwolAtlasSprite sprite = data.sprites[i];
                    string label = sprite != null ? sprite.name : "<null>";

                    if (!string.IsNullOrEmpty(spriteSearch) && (sprite == null || sprite.name == null || sprite.name.ToLowerInvariant().IndexOf(spriteSearch.ToLowerInvariant()) < 0))
                    {
                        continue;
                    }

                    if (GUILayout.Toggle(selectedSpriteIndex == i, label, "Button"))
                    {
                        selectedSpriteIndex = i;
                    }
                }

                EditorGUILayout.EndScrollView();
                DrawSelectedSprite();
            }
        }

        private void DrawSelectedSprite()
        {
            if (data == null || data.sprites == null || data.sprites.Length == 0)
            {
                return;
            }

            selectedSpriteIndex = Mathf.Clamp(selectedSpriteIndex, 0, data.sprites.Length - 1);
            SuwolAtlasSprite sprite = data.sprites[selectedSpriteIndex];

            using (new EditorGUILayout.VerticalScope())
            {
                if (sprite == null)
                {
                    EditorGUILayout.HelpBox("Selected sprite is null.", MessageType.Warning);
                    return;
                }

                EditorGUILayout.LabelField("Name", sprite.name);
                EditorGUILayout.LabelField("Page", sprite.page.ToString());
                EditorGUILayout.LabelField("Rect", sprite.x + ", " + sprite.y + ", " + sprite.w + ", " + sprite.h);
                EditorGUILayout.LabelField("Rotated", sprite.rotated.ToString());
                EditorGUILayout.LabelField("Trimmed", sprite.trimmed.ToString());
                EditorGUILayout.LabelField("Source", sprite.sourceW + "x" + sprite.sourceH);
                EditorGUILayout.LabelField("Offset", sprite.offsetX + ", " + sprite.offsetY);
                EditorGUILayout.LabelField("Pivot", sprite.pivotX + ", " + sprite.pivotY);
                DrawSpriteMetadata(sprite);

                DrawSpritePreview(sprite);
            }
        }

        private void DrawSpriteMetadata(SuwolAtlasSprite sprite)
        {
            if (metadata == null)
            {
                EditorGUILayout.LabelField("Metadata", "Sidecar not assigned");
                return;
            }

            EditorGUILayout.LabelField("Group", metadata.GetGroup(sprite.name));
            EditorGUILayout.LabelField("Tags", string.Join(", ", metadata.GetTags(sprite.name)));

            SuwolAtlasMetadataSprite sidecar;

            if (metadata.TryGetMetadata(sprite.name, out sidecar))
            {
                EditorGUILayout.LabelField("Order", sidecar.order.ToString());
                EditorGUILayout.LabelField("Trim Mode", string.IsNullOrEmpty(sidecar.trimMode) ? "default" : sidecar.trimMode);

                if (sidecar.crop != null)
                {
                    EditorGUILayout.LabelField("Crop", sidecar.crop.x + ", " + sidecar.crop.y + ", " + sidecar.crop.w + ", " + sidecar.crop.h);
                }
            }
        }

        private void DrawSpritePreview(SuwolAtlasSprite sprite)
        {
            if (pages == null || sprite.page < 0 || sprite.page >= pages.Length || pages[sprite.page] == null)
            {
                EditorGUILayout.HelpBox("Page texture is missing for preview.", MessageType.Info);
                return;
            }

            Texture2D texture = pages[sprite.page];
            Rect rect = GUILayoutUtility.GetRect(180, 180, GUILayout.ExpandWidth(false));
            Rect texCoords = new Rect(
                (float)sprite.x / texture.width,
                1f - ((float)sprite.y + sprite.h) / texture.height,
                (float)sprite.w / texture.width,
                (float)sprite.h / texture.height);

            GUI.DrawTextureWithTexCoords(rect, texture, texCoords, true);
        }

        private void DrawAssetCreator()
        {
            EditorGUILayout.Space();
            EditorGUILayout.LabelField("Runtime Asset", EditorStyles.boldLabel);
            pixelsPerUnit = EditorGUILayout.FloatField("Pixels Per Unit", pixelsPerUnit);

            using (new EditorGUI.DisabledScope(atlasJson == null || pages == null || pages.Length == 0 || !report.IsValid))
            {
                if (GUILayout.Button("Create/Update SuwolAtlasAsset"))
                {
                    CreateAtlasAsset();
                }
            }
        }

        private void CreateAtlasAsset()
        {
            string defaultName = data != null && !string.IsNullOrEmpty(data.name) ? data.name + ".asset" : "SuwolAtlasAsset.asset";
            string defaultFolder = "Assets";
            string jsonPath = AssetDatabase.GetAssetPath(atlasJson);

            if (!string.IsNullOrEmpty(jsonPath))
            {
                defaultFolder = Path.GetDirectoryName(jsonPath);
            }

            string path = EditorUtility.SaveFilePanelInProject(
                "Create Suwol Atlas Asset",
                defaultName,
                "asset",
                "Choose where to save the SuwolAtlasAsset.",
                defaultFolder);

            if (string.IsNullOrEmpty(path))
            {
                return;
            }

            SuwolAtlasAsset asset = CreateInstance<SuwolAtlasAsset>();
            asset.SetSource(atlasJson, pages, Mathf.Max(1f, pixelsPerUnit));
            AssetDatabase.CreateAsset(asset, path);
            AssetDatabase.SaveAssets();
            EditorGUIUtility.PingObject(asset);
        }

        private static void DrawMessages(string title, System.Collections.Generic.IList<string> messages, MessageType type)
        {
            for (int i = 0; i < messages.Count; i++)
            {
                EditorGUILayout.HelpBox(title + ": " + messages[i], type);
            }
        }
    }
}
