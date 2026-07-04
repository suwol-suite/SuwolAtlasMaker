using Microsoft.Xna.Framework.Content.Pipeline;
using Microsoft.Xna.Framework.Content.Pipeline.Serialization.Compiler;

namespace Suwol.AtlasMaker.MonoGame.Pipeline
{
    [ContentTypeWriter]
    public sealed class SuwolAtlasWriter : ContentTypeWriter<SuwolAtlasContent>
    {
        protected override void Write(ContentWriter output, SuwolAtlasContent value)
        {
            output.Write(value.Version);
            output.Write(value.Name ?? string.Empty);

            output.Write(value.Pages.Length);

            for (int i = 0; i < value.Pages.Length; i++)
            {
                SuwolAtlasPageContent page = value.Pages[i];
                output.Write(page.Image ?? string.Empty);
                output.Write(page.Width);
                output.Write(page.Height);
            }

            output.Write(value.Sprites.Length);

            for (int i = 0; i < value.Sprites.Length; i++)
            {
                SuwolAtlasSpriteContent sprite = value.Sprites[i];
                output.Write(sprite.Name ?? string.Empty);
                output.Write(sprite.Page);
                output.Write(sprite.X);
                output.Write(sprite.Y);
                output.Write(sprite.W);
                output.Write(sprite.H);
                output.Write(sprite.Rotated);
                output.Write(sprite.Trimmed);
                output.Write(sprite.SourceW);
                output.Write(sprite.SourceH);
                output.Write(sprite.OffsetX);
                output.Write(sprite.OffsetY);
                output.Write(sprite.PivotX);
                output.Write(sprite.PivotY);
            }
        }

        public override string GetRuntimeReader(TargetPlatform targetPlatform)
        {
            return "Suwol.AtlasMaker.MonoGame.SuwolAtlasReader, Suwol.AtlasMaker.MonoGame";
        }

        public override string GetRuntimeType(TargetPlatform targetPlatform)
        {
            return "Suwol.AtlasMaker.MonoGame.SuwolAtlasContent, Suwol.AtlasMaker.MonoGame";
        }
    }
}
