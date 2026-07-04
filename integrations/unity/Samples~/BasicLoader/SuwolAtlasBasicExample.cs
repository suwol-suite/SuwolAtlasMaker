using Suwol.AtlasMaker;
using UnityEngine;

namespace Suwol.AtlasMaker.Samples
{
    public sealed class SuwolAtlasBasicExample : MonoBehaviour
    {
        public TextAsset atlasJson;
        public Texture2D[] pages;
        public string spriteName;
        public SpriteRenderer targetRenderer;
        public float pixelsPerUnit = 100f;

        private SuwolAtlas atlas;

        private void Start()
        {
            if (targetRenderer == null)
            {
                targetRenderer = GetComponent<SpriteRenderer>();
            }

            atlas = SuwolAtlasLoader.Load(atlasJson, pages, pixelsPerUnit);

            if (string.IsNullOrEmpty(spriteName) && atlas.Sprites.Length > 0)
            {
                spriteName = atlas.Sprites[0].name;
            }

            if (targetRenderer != null && !string.IsNullOrEmpty(spriteName))
            {
                targetRenderer.sprite = atlas.CreateSprite(spriteName);
            }
        }

        public void SetSprite(string nextSpriteName)
        {
            if (atlas == null)
            {
                atlas = SuwolAtlasLoader.Load(atlasJson, pages, pixelsPerUnit);
            }

            if (targetRenderer == null)
            {
                targetRenderer = GetComponent<SpriteRenderer>();
            }

            spriteName = nextSpriteName;

            if (targetRenderer != null)
            {
                targetRenderer.sprite = atlas.CreateSprite(spriteName);
            }
        }

        private void OnDestroy()
        {
            if (atlas != null)
            {
                atlas.ClearCache();
                atlas = null;
            }
        }
    }
}
