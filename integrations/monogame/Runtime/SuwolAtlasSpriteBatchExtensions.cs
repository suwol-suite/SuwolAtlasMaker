using System;
using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;

namespace Suwol.AtlasMaker.MonoGame
{
    public static class SuwolAtlasSpriteBatchExtensions
    {
        public static void DrawAtlasSprite(
            this SpriteBatch spriteBatch,
            SuwolAtlas atlas,
            string spriteName,
            Vector2 position,
            Color color)
        {
            DrawAtlasSprite(
                spriteBatch,
                atlas,
                spriteName,
                position,
                color,
                0f,
                Vector2.One,
                SpriteEffects.None,
                0f);
        }

        public static void DrawAtlasSprite(
            this SpriteBatch spriteBatch,
            SuwolAtlas atlas,
            string spriteName,
            Vector2 position,
            Color color,
            float rotation,
            Vector2 scale,
            SpriteEffects effects,
            float layerDepth)
        {
            if (spriteBatch == null)
            {
                throw new ArgumentNullException("spriteBatch");
            }

            if (atlas == null)
            {
                throw new ArgumentNullException("atlas");
            }

            SuwolAtlasFrame frame = atlas.GetFrame(spriteName);
            Texture2D texture = atlas.GetPageTexture(frame.Page);

            if (!frame.Rotated)
            {
                spriteBatch.Draw(
                    texture,
                    position,
                    frame.SourceRectangle,
                    color,
                    rotation,
                    Vector2.Zero,
                    scale,
                    effects,
                    layerDepth);
                return;
            }

            float correctedRotation = rotation - MathHelper.PiOver2;
            Vector2 drawScale = new Vector2(scale.Y, scale.X);
            Vector2 correction = RotateVector(new Vector2(0f, frame.SourceRectangle.Width * scale.Y), rotation);

            spriteBatch.Draw(
                texture,
                position + correction,
                frame.SourceRectangle,
                color,
                correctedRotation,
                Vector2.Zero,
                drawScale,
                effects,
                layerDepth);
        }

        private static Vector2 RotateVector(Vector2 value, float rotation)
        {
            float cos = (float)Math.Cos(rotation);
            float sin = (float)Math.Sin(rotation);
            return new Vector2(value.X * cos - value.Y * sin, value.X * sin + value.Y * cos);
        }
    }
}
