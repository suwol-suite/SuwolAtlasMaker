using System;
using System.Collections.Generic;
using UnityEngine;

namespace Suwol.AtlasMaker
{
    public sealed class SuwolAtlasMetadata
    {
        private readonly SuwolAtlasMetadataData data;
        private readonly Dictionary<string, SuwolAtlasMetadataSprite> spritesByName;

        internal SuwolAtlasMetadata(SuwolAtlasMetadataData metadataData)
        {
            data = metadataData ?? throw new ArgumentNullException("metadataData");
            spritesByName = new Dictionary<string, SuwolAtlasMetadataSprite>(StringComparer.Ordinal);

            if (data.sprites == null)
            {
                data.sprites = new SuwolAtlasMetadataSprite[0];
            }

            for (int i = 0; i < data.sprites.Length; i++)
            {
                SuwolAtlasMetadataSprite sprite = data.sprites[i];

                if (sprite != null && !string.IsNullOrEmpty(sprite.name))
                {
                    spritesByName[sprite.name] = sprite;
                }
            }
        }

        public SuwolAtlasMetadataData Data
        {
            get { return data; }
        }

        public string GetGroup(string spriteName)
        {
            SuwolAtlasMetadataSprite sprite;
            return spritesByName.TryGetValue(spriteName, out sprite) ? sprite.group ?? string.Empty : string.Empty;
        }

        public string[] GetTags(string spriteName)
        {
            SuwolAtlasMetadataSprite sprite;
            return spritesByName.TryGetValue(spriteName, out sprite) && sprite.tags != null
                ? sprite.tags
                : new string[0];
        }

        public bool HasTag(string spriteName, string tag)
        {
            if (string.IsNullOrEmpty(tag))
            {
                return false;
            }

            string[] tags = GetTags(spriteName);

            for (int i = 0; i < tags.Length; i++)
            {
                if (string.Equals(tags[i], tag, StringComparison.Ordinal))
                {
                    return true;
                }
            }

            return false;
        }

        public bool TryGetSprite(string spriteName, out SuwolAtlasMetadataSprite sprite)
        {
            return spritesByName.TryGetValue(spriteName, out sprite);
        }

        public bool TryGetMetadata(string spriteName, out SuwolAtlasMetadataSprite metadata)
        {
            return TryGetSprite(spriteName, out metadata);
        }
    }

    public static class SuwolAtlasMetadataLoader
    {
        public static SuwolAtlasMetadata Load(TextAsset metadataJson)
        {
            if (metadataJson == null)
            {
                throw new ArgumentNullException("metadataJson");
            }

            SuwolAtlasMetadataData data = JsonUtility.FromJson<SuwolAtlasMetadataData>(metadataJson.text);

            if (data == null)
            {
                throw new ArgumentException("Failed to parse Suwol Atlas Maker metadata JSON.", "metadataJson");
            }

            if (data.version != 1)
            {
                throw new ArgumentException("Unsupported Suwol Atlas Maker metadata JSON version: " + data.version + ".", "metadataJson");
            }

            return new SuwolAtlasMetadata(data);
        }
    }
}
