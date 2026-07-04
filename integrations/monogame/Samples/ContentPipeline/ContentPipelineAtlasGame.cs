using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;
using Microsoft.Xna.Framework.Input;
using Suwol.AtlasMaker.MonoGame;

namespace Suwol.AtlasMaker.MonoGame.Samples
{
    public sealed class ContentPipelineAtlasGame : Game
    {
        private readonly GraphicsDeviceManager graphics;
        private SpriteBatch spriteBatch;
        private SuwolAtlas atlas;

        public string AtlasMetadataAsset = "advanced_atlas";
        public string[] PageTextureAssets = { "advanced_atlas" };
        public string SpriteName = "hero_idle_0";

        public ContentPipelineAtlasGame()
        {
            graphics = new GraphicsDeviceManager(this);
            IsMouseVisible = true;
        }

        protected override void LoadContent()
        {
            spriteBatch = new SpriteBatch(GraphicsDevice);

            SuwolAtlasContent content = Content.Load<SuwolAtlasContent>(AtlasMetadataAsset);
            Texture2D[] pages = new Texture2D[PageTextureAssets.Length];

            for (int i = 0; i < pages.Length; i++)
            {
                pages[i] = Content.Load<Texture2D>(PageTextureAssets[i]);
            }

            atlas = SuwolAtlasLoader.FromContent(content, pages);
        }

        protected override void Update(GameTime gameTime)
        {
            if (Keyboard.GetState().IsKeyDown(Keys.Escape))
            {
                Exit();
            }

            base.Update(gameTime);
        }

        protected override void Draw(GameTime gameTime)
        {
            GraphicsDevice.Clear(Color.Black);

            spriteBatch.Begin(samplerState: SamplerState.PointClamp);
            spriteBatch.DrawAtlasSprite(atlas, SpriteName, new Vector2(100f, 100f), Color.White);
            spriteBatch.End();

            base.Draw(gameTime);
        }

        protected override void UnloadContent()
        {
            if (atlas != null)
            {
                atlas.Dispose();
                atlas = null;
            }

            if (spriteBatch != null)
            {
                spriteBatch.Dispose();
                spriteBatch = null;
            }

            base.UnloadContent();
        }
    }
}
