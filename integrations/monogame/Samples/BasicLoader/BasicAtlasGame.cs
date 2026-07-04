using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;
using Microsoft.Xna.Framework.Input;
using Suwol.AtlasMaker.MonoGame;

namespace Suwol.AtlasMaker.MonoGame.Samples
{
    public sealed class BasicAtlasGame : Game
    {
        private readonly GraphicsDeviceManager graphics;
        private SpriteBatch spriteBatch;
        private SuwolAtlas atlas;

        public string AtlasJsonPath = "Content/sample_atlas.json";
        public string ImageDirectory = "Content";
        public string SpriteName = "hero_idle_0";

        public BasicAtlasGame()
        {
            graphics = new GraphicsDeviceManager(this);
            IsMouseVisible = true;
        }

        protected override void LoadContent()
        {
            spriteBatch = new SpriteBatch(GraphicsDevice);
            atlas = SuwolAtlasLoader.Load(GraphicsDevice, AtlasJsonPath, ImageDirectory);
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
            GraphicsDevice.Clear(Color.CornflowerBlue);

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
