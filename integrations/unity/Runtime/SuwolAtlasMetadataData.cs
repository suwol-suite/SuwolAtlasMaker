using System;

namespace Suwol.AtlasMaker
{
    [Serializable]
    public sealed class SuwolAtlasMetadataData
    {
        public int version;
        public string atlas;
        public SuwolAtlasMetadataSprite[] sprites;
    }

    [Serializable]
    public sealed class SuwolAtlasMetadataSprite
    {
        public string name;
        public string sourcePath;
        public string originalName;
        public bool included;
        public string group;
        public string[] tags;
        public float pivotX;
        public float pivotY;
        public int order;
        public string trimMode;
        public SuwolAtlasMetadataCrop crop;
    }

    [Serializable]
    public sealed class SuwolAtlasMetadataCrop
    {
        public int x;
        public int y;
        public int w;
        public int h;
    }
}
