using System;
using UnityEngine;

namespace Suwol.AtlasMaker
{
    public static class SuwolAtlasLoader
    {
        public static SuwolAtlas Load(TextAsset json, Texture2D[] pages)
        {
            return Load(json, pages, 100f);
        }

        public static SuwolAtlas Load(TextAsset json, Texture2D[] pages, float pixelsPerUnit)
        {
            if (json == null)
            {
                throw new ArgumentNullException("json");
            }

            if (string.IsNullOrEmpty(json.text))
            {
                throw new ArgumentException("Suwol Atlas Maker JSON TextAsset is empty.", "json");
            }

            SuwolAtlasData data = JsonUtility.FromJson<SuwolAtlasData>(json.text);

            if (data == null)
            {
                throw new ArgumentException("Failed to parse Suwol Atlas Maker JSON.", "json");
            }

            return new SuwolAtlas(data, pages, pixelsPerUnit);
        }
    }
}
