using Microsoft.Xna.Framework;

namespace Suwol.AtlasMaker.MonoGame
{
    public sealed class SuwolAtlasFrame
    {
        private readonly SuwolAtlasSprite sprite;

        internal SuwolAtlasFrame(SuwolAtlasSprite sprite)
        {
            this.sprite = sprite;
            SourceRectangle = new Rectangle(sprite.X, sprite.Y, sprite.W, sprite.H);
        }

        public string Name
        {
            get { return sprite.Name; }
        }

        public int Page
        {
            get { return sprite.Page; }
        }

        public Rectangle SourceRectangle { get; private set; }

        public bool Rotated
        {
            get { return sprite.Rotated; }
        }

        public bool Trimmed
        {
            get { return sprite.Trimmed; }
        }

        public int SourceWidth
        {
            get { return sprite.SourceW; }
        }

        public int SourceHeight
        {
            get { return sprite.SourceH; }
        }

        public int OffsetX
        {
            get { return sprite.OffsetX; }
        }

        public int OffsetY
        {
            get { return sprite.OffsetY; }
        }

        public float PivotX
        {
            get { return sprite.PivotX; }
        }

        public float PivotY
        {
            get { return sprite.PivotY; }
        }

        public SuwolAtlasSprite Data
        {
            get { return sprite; }
        }

        public Point GetSourceSize()
        {
            return new Point(SourceWidth, SourceHeight);
        }

        public Point GetTrimOffset()
        {
            return new Point(OffsetX, OffsetY);
        }

        public Vector2 GetPivotPixels()
        {
            return new Vector2(SourceRectangle.Width * PivotX, SourceRectangle.Height * PivotY);
        }
    }
}
