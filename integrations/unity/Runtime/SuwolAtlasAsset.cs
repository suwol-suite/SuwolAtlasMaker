using System;
using UnityEngine;

namespace Suwol.AtlasMaker
{
    [CreateAssetMenu(fileName = "SuwolAtlasAsset", menuName = "Suwol Atlas Maker/Atlas Asset")]
    public sealed class SuwolAtlasAsset : ScriptableObject
    {
        [SerializeField] private TextAsset atlasJson;
        [SerializeField] private Texture2D[] pages;
        [SerializeField] private float pixelsPerUnit = 100f;

        public TextAsset AtlasJson
        {
            get { return atlasJson; }
        }

        public Texture2D[] Pages
        {
            get { return pages; }
        }

        public float PixelsPerUnit
        {
            get { return pixelsPerUnit; }
        }

        public void SetSource(TextAsset json, Texture2D[] pageTextures, float atlasPixelsPerUnit)
        {
            if (atlasPixelsPerUnit <= 0f)
            {
                throw new ArgumentOutOfRangeException("atlasPixelsPerUnit", "Pixels per unit must be greater than zero.");
            }

            atlasJson = json;
            pages = pageTextures;
            pixelsPerUnit = atlasPixelsPerUnit;
        }

        public SuwolAtlas Load()
        {
            return SuwolAtlasLoader.Load(atlasJson, pages, pixelsPerUnit);
        }

        public Sprite CreateSprite(string spriteName)
        {
            return Load().CreateSprite(spriteName);
        }

        public bool TryCreateSprite(string spriteName, out Sprite sprite)
        {
            sprite = null;

            if (atlasJson == null || pages == null)
            {
                return false;
            }

            return Load().TryCreateSprite(spriteName, out sprite);
        }
    }
}
