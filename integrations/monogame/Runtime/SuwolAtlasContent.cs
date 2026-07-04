namespace Suwol.AtlasMaker.MonoGame
{
    public sealed class SuwolAtlasContent
    {
        public int Version { get; set; }
        public string Name { get; set; }
        public SuwolAtlasPageContent[] Pages { get; set; }
        public SuwolAtlasSpriteContent[] Sprites { get; set; }

        public SuwolAtlasData ToAtlasData()
        {
            SuwolAtlasPage[] pages = new SuwolAtlasPage[Pages != null ? Pages.Length : 0];
            SuwolAtlasSprite[] sprites = new SuwolAtlasSprite[Sprites != null ? Sprites.Length : 0];

            for (int i = 0; i < pages.Length; i++)
            {
                SuwolAtlasPageContent page = Pages[i];
                pages[i] = new SuwolAtlasPage
                {
                    Image = page != null ? page.Image : null,
                    Width = page != null ? page.Width : 0,
                    Height = page != null ? page.Height : 0
                };
            }

            for (int i = 0; i < sprites.Length; i++)
            {
                SuwolAtlasSpriteContent sprite = Sprites[i];
                sprites[i] = new SuwolAtlasSprite
                {
                    Name = sprite != null ? sprite.Name : null,
                    Page = sprite != null ? sprite.Page : 0,
                    X = sprite != null ? sprite.X : 0,
                    Y = sprite != null ? sprite.Y : 0,
                    W = sprite != null ? sprite.W : 0,
                    H = sprite != null ? sprite.H : 0,
                    Rotated = sprite != null && sprite.Rotated,
                    Trimmed = sprite != null && sprite.Trimmed,
                    SourceW = sprite != null ? sprite.SourceW : 0,
                    SourceH = sprite != null ? sprite.SourceH : 0,
                    OffsetX = sprite != null ? sprite.OffsetX : 0,
                    OffsetY = sprite != null ? sprite.OffsetY : 0,
                    PivotX = sprite != null ? sprite.PivotX : 0f,
                    PivotY = sprite != null ? sprite.PivotY : 0f
                };
            }

            return new SuwolAtlasData
            {
                Version = Version,
                Name = Name,
                Pages = pages,
                Sprites = sprites
            };
        }
    }

    public sealed class SuwolAtlasPageContent
    {
        public string Image { get; set; }
        public int Width { get; set; }
        public int Height { get; set; }
    }

    public sealed class SuwolAtlasSpriteContent
    {
        public string Name { get; set; }
        public int Page { get; set; }
        public int X { get; set; }
        public int Y { get; set; }
        public int W { get; set; }
        public int H { get; set; }
        public bool Rotated { get; set; }
        public bool Trimmed { get; set; }
        public int SourceW { get; set; }
        public int SourceH { get; set; }
        public int OffsetX { get; set; }
        public int OffsetY { get; set; }
        public float PivotX { get; set; }
        public float PivotY { get; set; }
    }
}
