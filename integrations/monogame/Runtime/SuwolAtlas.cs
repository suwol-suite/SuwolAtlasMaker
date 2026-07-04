using System;
using System.Collections.Generic;
using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;

namespace Suwol.AtlasMaker.MonoGame
{
    public sealed class SuwolAtlas : IDisposable
    {
        private const int SupportedVersion = 1;

        private readonly SuwolAtlasData data;
        private readonly Texture2D[] pageTextures;
        private readonly bool ownsTextures;
        private readonly Dictionary<string, SuwolAtlasFrame> framesByName;
        private bool disposed;

        internal SuwolAtlas(SuwolAtlasData data, Texture2D[] pageTextures, bool ownsTextures)
        {
            if (data == null)
            {
                throw new ArgumentNullException("data");
            }

            if (pageTextures == null)
            {
                throw new ArgumentNullException("pageTextures");
            }

            this.data = data;
            this.pageTextures = pageTextures;
            this.ownsTextures = ownsTextures;
            this.framesByName = new Dictionary<string, SuwolAtlasFrame>(StringComparer.Ordinal);

            ValidateData();
        }

        public SuwolAtlasData Data
        {
            get
            {
                ThrowIfDisposed();
                return data;
            }
        }

        public SuwolAtlasPage[] Pages
        {
            get
            {
                ThrowIfDisposed();
                return data.Pages;
            }
        }

        public SuwolAtlasFrame GetFrame(string name)
        {
            ThrowIfDisposed();

            if (string.IsNullOrEmpty(name))
            {
                throw new ArgumentException("Sprite name must not be empty.", "name");
            }

            SuwolAtlasFrame frame;

            if (!framesByName.TryGetValue(name, out frame))
            {
                throw new KeyNotFoundException("Sprite not found in Suwol Atlas Maker atlas: " + name);
            }

            return frame;
        }

        public bool TryGetFrame(string name, out SuwolAtlasFrame frame)
        {
            ThrowIfDisposed();

            if (string.IsNullOrEmpty(name))
            {
                frame = null;
                return false;
            }

            return framesByName.TryGetValue(name, out frame);
        }

        public Texture2D GetPageTexture(int page)
        {
            ThrowIfDisposed();

            if (page < 0 || page >= pageTextures.Length)
            {
                throw new ArgumentOutOfRangeException("page", "Atlas page index is outside the Texture2D page array.");
            }

            Texture2D texture = pageTextures[page];

            if (texture == null)
            {
                throw new InvalidOperationException("Atlas page texture is null at index " + page + ".");
            }

            return texture;
        }

        public Rectangle GetSourceRectangle(string name)
        {
            return GetFrame(name).SourceRectangle;
        }

        public bool TryGetSourceRectangle(string name, out Rectangle rect)
        {
            SuwolAtlasFrame frame;

            if (!TryGetFrame(name, out frame))
            {
                rect = Rectangle.Empty;
                return false;
            }

            rect = frame.SourceRectangle;
            return true;
        }

        public void Dispose()
        {
            if (disposed)
            {
                return;
            }

            if (ownsTextures)
            {
                for (int i = 0; i < pageTextures.Length; i++)
                {
                    if (pageTextures[i] != null)
                    {
                        pageTextures[i].Dispose();
                        pageTextures[i] = null;
                    }
                }
            }

            disposed = true;
        }

        private void ValidateData()
        {
            if (data.Version != SupportedVersion)
            {
                throw new NotSupportedException("Unsupported Suwol Atlas Maker JSON version: " + data.Version + ".");
            }

            if (data.Pages == null || data.Pages.Length == 0)
            {
                throw new ArgumentException("Suwol Atlas Maker JSON must contain at least one page.");
            }

            if (data.Sprites == null || data.Sprites.Length == 0)
            {
                throw new ArgumentException("Suwol Atlas Maker JSON must contain at least one sprite.");
            }

            if (pageTextures.Length != data.Pages.Length)
            {
                throw new ArgumentException(
                    "Texture2D page count does not match JSON page count. JSON pages: " +
                    data.Pages.Length + ", textures: " + pageTextures.Length + ".");
            }

            for (int i = 0; i < data.Pages.Length; i++)
            {
                ValidatePage(i);
            }

            for (int i = 0; i < data.Sprites.Length; i++)
            {
                ValidateSprite(data.Sprites[i], i);
            }
        }

        private void ValidatePage(int index)
        {
            SuwolAtlasPage page = data.Pages[index];
            Texture2D texture = pageTextures[index];

            if (page == null)
            {
                throw new ArgumentException("JSON page entry is null at index " + index + ".");
            }

            if (string.IsNullOrEmpty(page.Image))
            {
                throw new ArgumentException("JSON page image is empty at index " + index + ".");
            }

            if (page.Width <= 0 || page.Height <= 0)
            {
                throw new ArgumentException("JSON page size must be positive at index " + index + ".");
            }

            if (texture == null)
            {
                throw new ArgumentException("Texture2D page is null at index " + index + ".");
            }

            if (texture.Width != page.Width || texture.Height != page.Height)
            {
                throw new ArgumentException(
                    "Texture2D size does not match JSON page '" + page.Image + "'. JSON: " +
                    page.Width + "x" + page.Height + ", texture: " + texture.Width + "x" + texture.Height + ".");
            }
        }

        private void ValidateSprite(SuwolAtlasSprite sprite, int index)
        {
            if (sprite == null)
            {
                throw new ArgumentException("JSON sprite entry is null at index " + index + ".");
            }

            if (string.IsNullOrEmpty(sprite.Name))
            {
                throw new ArgumentException("JSON sprite name is empty at index " + index + ".");
            }

            if (framesByName.ContainsKey(sprite.Name))
            {
                throw new ArgumentException("Duplicate sprite name in Suwol Atlas Maker JSON: " + sprite.Name + ".");
            }

            if (sprite.Page < 0 || sprite.Page >= data.Pages.Length)
            {
                throw new ArgumentException("Sprite '" + sprite.Name + "' references invalid page index " + sprite.Page + ".");
            }

            if (sprite.W <= 0 || sprite.H <= 0 || sprite.SourceW <= 0 || sprite.SourceH <= 0)
            {
                throw new ArgumentException("Sprite '" + sprite.Name + "' has invalid dimensions.");
            }

            SuwolAtlasPage page = data.Pages[sprite.Page];

            if (sprite.X < 0 || sprite.Y < 0 || sprite.X + sprite.W > page.Width || sprite.Y + sprite.H > page.Height)
            {
                throw new ArgumentException("Sprite '" + sprite.Name + "' rect is outside page '" + page.Image + "'.");
            }

            framesByName.Add(sprite.Name, new SuwolAtlasFrame(sprite));
        }

        private void ThrowIfDisposed()
        {
            if (disposed)
            {
                throw new ObjectDisposedException("SuwolAtlas");
            }
        }
    }
}
