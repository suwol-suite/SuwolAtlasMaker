using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;

namespace Suwol.AtlasMaker.MonoGame
{
    public sealed class SuwolAtlasMetadata
    {
        private readonly SuwolAtlasMetadataData data;
        private readonly Dictionary<string, SuwolAtlasMetadataSprite> spritesByName;

        internal SuwolAtlasMetadata(SuwolAtlasMetadataData metadataData)
        {
            if (metadataData == null)
            {
                throw new ArgumentNullException("metadataData");
            }

            data = metadataData;
            spritesByName = new Dictionary<string, SuwolAtlasMetadataSprite>(StringComparer.Ordinal);

            if (data.Sprites == null)
            {
                data.Sprites = new SuwolAtlasMetadataSprite[0];
            }

            for (int i = 0; i < data.Sprites.Length; i++)
            {
                SuwolAtlasMetadataSprite sprite = data.Sprites[i];

                if (sprite != null && !string.IsNullOrEmpty(sprite.Name))
                {
                    spritesByName[sprite.Name] = sprite;
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
            return spritesByName.TryGetValue(spriteName, out sprite) ? sprite.Group ?? string.Empty : string.Empty;
        }

        public string[] GetTags(string spriteName)
        {
            SuwolAtlasMetadataSprite sprite;
            return spritesByName.TryGetValue(spriteName, out sprite) && sprite.Tags != null
                ? sprite.Tags
                : Array.Empty<string>();
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
        public static SuwolAtlasMetadata Load(string path)
        {
            if (string.IsNullOrEmpty(path))
            {
                throw new ArgumentException("Metadata path must not be empty.", "path");
            }

            using (Stream stream = File.OpenRead(path))
            {
                return Load(stream);
            }
        }

        public static SuwolAtlasMetadata Load(Stream stream)
        {
            if (stream == null)
            {
                throw new ArgumentNullException("stream");
            }

            SuwolAtlasMetadataData data = JsonSerializer.Deserialize<SuwolAtlasMetadataData>(
                stream,
                new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = false
                });

            if (data == null)
            {
                throw new ArgumentException("Failed to parse Suwol Atlas Maker metadata JSON.", "stream");
            }

            if (data.Version != 1)
            {
                throw new ArgumentException("Unsupported Suwol Atlas Maker metadata JSON version: " + data.Version + ".", "stream");
            }

            return new SuwolAtlasMetadata(data);
        }
    }
}
