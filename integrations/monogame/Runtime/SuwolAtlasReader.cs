using Microsoft.Xna.Framework.Content;

namespace Suwol.AtlasMaker.MonoGame
{
    public sealed class SuwolAtlasReader : ContentTypeReader<SuwolAtlasContent>
    {
        protected override SuwolAtlasContent Read(ContentReader input, SuwolAtlasContent existingInstance)
        {
            SuwolAtlasContent content = existingInstance ?? new SuwolAtlasContent();
            content.Version = input.ReadInt32();
            content.Name = input.ReadString();

            int pageCount = input.ReadInt32();
            content.Pages = new SuwolAtlasPageContent[pageCount];

            for (int i = 0; i < pageCount; i++)
            {
                content.Pages[i] = new SuwolAtlasPageContent
                {
                    Image = input.ReadString(),
                    Width = input.ReadInt32(),
                    Height = input.ReadInt32()
                };
            }

            int spriteCount = input.ReadInt32();
            content.Sprites = new SuwolAtlasSpriteContent[spriteCount];

            for (int i = 0; i < spriteCount; i++)
            {
                content.Sprites[i] = new SuwolAtlasSpriteContent
                {
                    Name = input.ReadString(),
                    Page = input.ReadInt32(),
                    X = input.ReadInt32(),
                    Y = input.ReadInt32(),
                    W = input.ReadInt32(),
                    H = input.ReadInt32(),
                    Rotated = input.ReadBoolean(),
                    Trimmed = input.ReadBoolean(),
                    SourceW = input.ReadInt32(),
                    SourceH = input.ReadInt32(),
                    OffsetX = input.ReadInt32(),
                    OffsetY = input.ReadInt32(),
                    PivotX = input.ReadSingle(),
                    PivotY = input.ReadSingle()
                };
            }

            return content;
        }
    }
}
