using System.Text.Json.Serialization;

namespace Suwol.AtlasMaker.MonoGame
{
    public sealed class SuwolAtlasData
    {
        [JsonPropertyName("version")]
        public int Version { get; set; }

        [JsonPropertyName("name")]
        public string Name { get; set; }

        [JsonPropertyName("pages")]
        public SuwolAtlasPage[] Pages { get; set; }

        [JsonPropertyName("sprites")]
        public SuwolAtlasSprite[] Sprites { get; set; }
    }

    public sealed class SuwolAtlasPage
    {
        [JsonPropertyName("image")]
        public string Image { get; set; }

        [JsonPropertyName("width")]
        public int Width { get; set; }

        [JsonPropertyName("height")]
        public int Height { get; set; }
    }

    public sealed class SuwolAtlasSprite
    {
        [JsonPropertyName("name")]
        public string Name { get; set; }

        [JsonPropertyName("page")]
        public int Page { get; set; }

        [JsonPropertyName("x")]
        public int X { get; set; }

        [JsonPropertyName("y")]
        public int Y { get; set; }

        [JsonPropertyName("w")]
        public int W { get; set; }

        [JsonPropertyName("h")]
        public int H { get; set; }

        [JsonPropertyName("rotated")]
        public bool Rotated { get; set; }

        [JsonPropertyName("trimmed")]
        public bool Trimmed { get; set; }

        [JsonPropertyName("sourceW")]
        public int SourceW { get; set; }

        [JsonPropertyName("sourceH")]
        public int SourceH { get; set; }

        [JsonPropertyName("offsetX")]
        public int OffsetX { get; set; }

        [JsonPropertyName("offsetY")]
        public int OffsetY { get; set; }

        [JsonPropertyName("pivotX")]
        public float PivotX { get; set; }

        [JsonPropertyName("pivotY")]
        public float PivotY { get; set; }
    }
}
