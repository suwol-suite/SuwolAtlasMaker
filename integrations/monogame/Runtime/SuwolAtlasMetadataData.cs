using System.Text.Json.Serialization;

namespace Suwol.AtlasMaker.MonoGame
{
    public sealed class SuwolAtlasMetadataData
    {
        [JsonPropertyName("version")]
        public int Version { get; set; }

        [JsonPropertyName("atlas")]
        public string Atlas { get; set; }

        [JsonPropertyName("sprites")]
        public SuwolAtlasMetadataSprite[] Sprites { get; set; }
    }

    public sealed class SuwolAtlasMetadataSprite
    {
        [JsonPropertyName("name")]
        public string Name { get; set; }

        [JsonPropertyName("sourcePath")]
        public string SourcePath { get; set; }

        [JsonPropertyName("originalName")]
        public string OriginalName { get; set; }

        [JsonPropertyName("included")]
        public bool Included { get; set; }

        [JsonPropertyName("group")]
        public string Group { get; set; }

        [JsonPropertyName("tags")]
        public string[] Tags { get; set; }

        [JsonPropertyName("pivotX")]
        public float PivotX { get; set; }

        [JsonPropertyName("pivotY")]
        public float PivotY { get; set; }

        [JsonPropertyName("order")]
        public int Order { get; set; }

        [JsonPropertyName("trimMode")]
        public string TrimMode { get; set; }

        [JsonPropertyName("crop")]
        public SuwolAtlasMetadataCrop Crop { get; set; }
    }

    public sealed class SuwolAtlasMetadataCrop
    {
        [JsonPropertyName("x")]
        public int X { get; set; }

        [JsonPropertyName("y")]
        public int Y { get; set; }

        [JsonPropertyName("w")]
        public int W { get; set; }

        [JsonPropertyName("h")]
        public int H { get; set; }
    }
}
