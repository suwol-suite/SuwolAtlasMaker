using System;
using System.Collections.Generic;
using UnityEngine;

namespace Suwol.AtlasMaker
{
    public sealed class SuwolAtlas
    {
        private const int SupportedVersion = 1;

        private readonly SuwolAtlasData data;
        private readonly Texture2D[] pageTextures;
        private readonly float pixelsPerUnit;
        private readonly Dictionary<string, SuwolAtlasSprite> framesByName;
        private readonly Dictionary<string, Sprite> spriteCache;
        private readonly Dictionary<string, Texture2D> rotatedTextureCache;

        public SuwolAtlasData Data
        {
            get { return data; }
        }

        public SuwolAtlasPage[] Pages
        {
            get { return data.pages; }
        }

        public SuwolAtlasSprite[] Sprites
        {
            get { return data.sprites; }
        }

        internal SuwolAtlas(SuwolAtlasData data, Texture2D[] pageTextures, float pixelsPerUnit)
        {
            if (data == null)
            {
                throw new ArgumentNullException("data");
            }

            if (pageTextures == null)
            {
                throw new ArgumentNullException("pageTextures");
            }

            if (pixelsPerUnit <= 0f)
            {
                throw new ArgumentOutOfRangeException("pixelsPerUnit", "Pixels per unit must be greater than zero.");
            }

            this.data = data;
            this.pageTextures = pageTextures;
            this.pixelsPerUnit = pixelsPerUnit;
            this.framesByName = new Dictionary<string, SuwolAtlasSprite>(StringComparer.Ordinal);
            this.spriteCache = new Dictionary<string, Sprite>(StringComparer.Ordinal);
            this.rotatedTextureCache = new Dictionary<string, Texture2D>(StringComparer.Ordinal);

            ValidateData();
        }

        public SuwolAtlasSprite GetFrame(string spriteName)
        {
            if (string.IsNullOrEmpty(spriteName))
            {
                throw new ArgumentException("Sprite name must not be empty.", "spriteName");
            }

            SuwolAtlasSprite frame;

            if (!framesByName.TryGetValue(spriteName, out frame))
            {
                throw new KeyNotFoundException("Sprite not found in Suwol Atlas Maker atlas: " + spriteName);
            }

            return frame;
        }

        public bool TryGetFrame(string spriteName, out SuwolAtlasSprite frame)
        {
            if (string.IsNullOrEmpty(spriteName))
            {
                frame = null;
                return false;
            }

            return framesByName.TryGetValue(spriteName, out frame);
        }

        public Texture2D GetPageTexture(int page)
        {
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

        public Sprite CreateSprite(string spriteName)
        {
            if (string.IsNullOrEmpty(spriteName))
            {
                throw new ArgumentException("Sprite name must not be empty.", "spriteName");
            }

            Sprite cached;

            if (spriteCache.TryGetValue(spriteName, out cached))
            {
                return cached;
            }

            SuwolAtlasSprite frame = GetFrame(spriteName);
            Sprite sprite = frame.rotated ? CreateUnrotatedSprite(spriteName, frame) : CreateAtlasSprite(frame);
            spriteCache.Add(spriteName, sprite);
            return sprite;
        }

        public bool TryCreateSprite(string spriteName, out Sprite sprite)
        {
            sprite = null;

            if (string.IsNullOrEmpty(spriteName) || !framesByName.ContainsKey(spriteName))
            {
                return false;
            }

            sprite = CreateSprite(spriteName);
            return true;
        }

        public Vector2 GetTrimOffsetPixels(string spriteName)
        {
            SuwolAtlasSprite frame = GetFrame(spriteName);
            return new Vector2(frame.offsetX, frame.offsetY);
        }

        public Vector2 GetSourceSizePixels(string spriteName)
        {
            SuwolAtlasSprite frame = GetFrame(spriteName);
            return new Vector2(frame.sourceW, frame.sourceH);
        }

        public void ClearCache()
        {
            ClearCache(true);
        }

        public void ClearCache(bool destroyObjects)
        {
            if (destroyObjects)
            {
                foreach (Sprite sprite in spriteCache.Values)
                {
                    DestroyUnityObject(sprite);
                }

                foreach (Texture2D texture in rotatedTextureCache.Values)
                {
                    DestroyUnityObject(texture);
                }
            }

            spriteCache.Clear();
            rotatedTextureCache.Clear();
        }

        private Sprite CreateAtlasSprite(SuwolAtlasSprite frame)
        {
            Texture2D texture = GetPageTexture(frame.page);
            Rect rect = ToUnityRect(frame, texture);
            Vector2 pivot = new Vector2(frame.pivotX, frame.pivotY);
            return Sprite.Create(texture, rect, pivot, pixelsPerUnit);
        }

        private Sprite CreateUnrotatedSprite(string spriteName, SuwolAtlasSprite frame)
        {
            Texture2D texture;

            if (!rotatedTextureCache.TryGetValue(spriteName, out texture))
            {
                texture = CreateUnrotatedTexture(frame);
                rotatedTextureCache.Add(spriteName, texture);
            }

            Rect rect = new Rect(0f, 0f, texture.width, texture.height);
            Vector2 pivot = new Vector2(frame.pivotX, frame.pivotY);
            return Sprite.Create(texture, rect, pivot, pixelsPerUnit);
        }

        private Texture2D CreateUnrotatedTexture(SuwolAtlasSprite frame)
        {
            Texture2D pageTexture = GetPageTexture(frame.page);
            int rotatedWidth = frame.w;
            int rotatedHeight = frame.h;
            int outputWidth = rotatedHeight;
            int outputHeight = rotatedWidth;
            int unityY = pageTexture.height - frame.y - frame.h;

            Color[] sourcePixels;

            try
            {
                sourcePixels = pageTexture.GetPixels(frame.x, unityY, rotatedWidth, rotatedHeight);
            }
            catch (UnityException exception)
            {
                throw new InvalidOperationException(
                    "Rotated sprites require the atlas page Texture2D to have Read/Write Enabled in Unity import settings.",
                    exception);
            }

            Color[] outputPixels = new Color[outputWidth * outputHeight];

            for (int rotatedYTop = 0; rotatedYTop < rotatedHeight; rotatedYTop++)
            {
                int sourceYBottom = rotatedHeight - 1 - rotatedYTop;

                for (int rotatedX = 0; rotatedX < rotatedWidth; rotatedX++)
                {
                    Color color = sourcePixels[sourceYBottom * rotatedWidth + rotatedX];
                    int outputX = rotatedYTop;
                    int outputYBottom = rotatedX;
                    outputPixels[outputYBottom * outputWidth + outputX] = color;
                }
            }

            Texture2D output = new Texture2D(outputWidth, outputHeight, TextureFormat.RGBA32, false);
            output.name = data.name + "_" + frame.name + "_unrotated";
            output.SetPixels(outputPixels);
            output.Apply(false, false);
            return output;
        }

        private Rect ToUnityRect(SuwolAtlasSprite frame, Texture2D texture)
        {
            float unityY = texture.height - frame.y - frame.h;
            return new Rect(frame.x, unityY, frame.w, frame.h);
        }

        private void ValidateData()
        {
            if (data.version != SupportedVersion)
            {
                throw new NotSupportedException("Unsupported Suwol Atlas Maker JSON version: " + data.version + ".");
            }

            if (data.pages == null || data.pages.Length == 0)
            {
                throw new ArgumentException("Suwol Atlas Maker JSON must contain at least one page.");
            }

            if (data.sprites == null)
            {
                throw new ArgumentException("Suwol Atlas Maker JSON sprites array is missing.");
            }

            if (pageTextures.Length != data.pages.Length)
            {
                throw new ArgumentException(
                    "Texture2D page count does not match JSON page count. JSON pages: " +
                    data.pages.Length + ", textures: " + pageTextures.Length + ".");
            }

            for (int i = 0; i < data.pages.Length; i++)
            {
                ValidatePage(i);
            }

            for (int i = 0; i < data.sprites.Length; i++)
            {
                ValidateSprite(data.sprites[i], i);
            }
        }

        private void ValidatePage(int index)
        {
            SuwolAtlasPage page = data.pages[index];
            Texture2D texture = pageTextures[index];

            if (page == null)
            {
                throw new ArgumentException("JSON page entry is null at index " + index + ".");
            }

            if (string.IsNullOrEmpty(page.image))
            {
                throw new ArgumentException("JSON page image is empty at index " + index + ".");
            }

            if (page.width <= 0 || page.height <= 0)
            {
                throw new ArgumentException("JSON page size must be positive at index " + index + ".");
            }

            if (texture == null)
            {
                throw new ArgumentException("Texture2D page is null at index " + index + ".");
            }

            if (texture.width != page.width || texture.height != page.height)
            {
                throw new ArgumentException(
                    "Texture2D size does not match JSON page '" + page.image + "'. JSON: " +
                    page.width + "x" + page.height + ", texture: " + texture.width + "x" + texture.height + ".");
            }
        }

        private void ValidateSprite(SuwolAtlasSprite frame, int index)
        {
            if (frame == null)
            {
                throw new ArgumentException("JSON sprite entry is null at index " + index + ".");
            }

            if (string.IsNullOrEmpty(frame.name))
            {
                throw new ArgumentException("JSON sprite name is empty at index " + index + ".");
            }

            if (framesByName.ContainsKey(frame.name))
            {
                throw new ArgumentException("Duplicate sprite name in Suwol Atlas Maker JSON: " + frame.name + ".");
            }

            if (frame.page < 0 || frame.page >= data.pages.Length)
            {
                throw new ArgumentException("Sprite '" + frame.name + "' references invalid page index " + frame.page + ".");
            }

            if (frame.w <= 0 || frame.h <= 0 || frame.sourceW <= 0 || frame.sourceH <= 0)
            {
                throw new ArgumentException("Sprite '" + frame.name + "' has invalid dimensions.");
            }

            SuwolAtlasPage page = data.pages[frame.page];

            if (frame.x < 0 || frame.y < 0 || frame.x + frame.w > page.width || frame.y + frame.h > page.height)
            {
                throw new ArgumentException("Sprite '" + frame.name + "' rect is outside page '" + page.image + "'.");
            }

            framesByName.Add(frame.name, frame);
        }

        private static void DestroyUnityObject(UnityEngine.Object obj)
        {
            if (obj == null)
            {
                return;
            }

            if (Application.isPlaying)
            {
                UnityEngine.Object.Destroy(obj);
            }
            else
            {
                UnityEngine.Object.DestroyImmediate(obj);
            }
        }
    }
}
