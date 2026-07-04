using System;

namespace Suwol.AtlasMaker
{
    [Serializable]
    public sealed class SuwolAtlasData
    {
        public int version;
        public string name;
        public SuwolAtlasPage[] pages;
        public SuwolAtlasSprite[] sprites;
    }

    [Serializable]
    public sealed class SuwolAtlasPage
    {
        public string image;
        public int width;
        public int height;
    }

    [Serializable]
    public sealed class SuwolAtlasSprite
    {
        public string name;
        public int page;
        public int x;
        public int y;
        public int w;
        public int h;
        public bool rotated;
        public bool trimmed;
        public int sourceW;
        public int sourceH;
        public int offsetX;
        public int offsetY;
        public float pivotX;
        public float pivotY;
    }
}
