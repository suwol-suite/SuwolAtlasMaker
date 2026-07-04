using Suwol.AtlasMaker;
using UnityEngine;

namespace Suwol.AtlasMaker.Samples
{
    public sealed class SuwolAtlasAssetExample : MonoBehaviour
    {
        public SuwolAtlasAsset atlasAsset;
        public string spriteName = "hero_idle_0";
        public SpriteRenderer targetRenderer;

        private void Start()
        {
            if (atlasAsset == null || targetRenderer == null)
            {
                return;
            }

            targetRenderer.sprite = atlasAsset.CreateSprite(spriteName);
        }
    }
}
