using System.Collections.Generic;
using Microsoft.Xna.Framework.Content.Pipeline;

namespace Suwol.AtlasMaker.MonoGame.Pipeline
{
    [ContentProcessor(DisplayName = "Suwol Atlas Maker Atlas Processor")]
    public sealed class SuwolAtlasProcessor : ContentProcessor<SuwolAtlasContent, SuwolAtlasContent>
    {
        public override SuwolAtlasContent Process(SuwolAtlasContent input, ContentProcessorContext context)
        {
            Validate(input);
            context.Logger.LogMessage(
                "Processed Suwol Atlas Maker atlas '{0}' with {1} page(s) and {2} sprite(s).",
                input.Name,
                input.Pages.Length,
                input.Sprites.Length);
            return input;
        }

        private static void Validate(SuwolAtlasContent input)
        {
            if (input == null)
            {
                throw new InvalidContentException("Atlas content is null.");
            }

            if (input.Version != 1)
            {
                throw new InvalidContentException("Unsupported Suwol Atlas Maker JSON version: " + input.Version + ".");
            }

            if (input.Pages == null || input.Pages.Length == 0)
            {
                throw new InvalidContentException("Atlas JSON must contain at least one page.");
            }

            if (input.Sprites == null || input.Sprites.Length == 0)
            {
                throw new InvalidContentException("Atlas JSON must contain at least one sprite.");
            }

            for (int i = 0; i < input.Pages.Length; i++)
            {
                ValidatePage(input.Pages[i], i);
            }

            HashSet<string> names = new HashSet<string>();

            for (int i = 0; i < input.Sprites.Length; i++)
            {
                ValidateSprite(input.Sprites[i], i, input.Pages, names);
            }
        }

        private static void ValidatePage(SuwolAtlasPageContent page, int index)
        {
            if (page == null)
            {
                throw new InvalidContentException("JSON page entry is null at index " + index + ".");
            }

            if (string.IsNullOrEmpty(page.Image))
            {
                throw new InvalidContentException("JSON page image is empty at index " + index + ".");
            }

            if (page.Width <= 0 || page.Height <= 0)
            {
                throw new InvalidContentException("JSON page size must be positive at index " + index + ".");
            }
        }

        private static void ValidateSprite(SuwolAtlasSpriteContent sprite, int index, SuwolAtlasPageContent[] pages, HashSet<string> names)
        {
            if (sprite == null)
            {
                throw new InvalidContentException("JSON sprite entry is null at index " + index + ".");
            }

            if (string.IsNullOrEmpty(sprite.Name))
            {
                throw new InvalidContentException("JSON sprite name is empty at index " + index + ".");
            }

            if (!names.Add(sprite.Name))
            {
                throw new InvalidContentException("Duplicate sprite name in Suwol Atlas Maker JSON: " + sprite.Name + ".");
            }

            if (sprite.Page < 0 || sprite.Page >= pages.Length)
            {
                throw new InvalidContentException("Sprite '" + sprite.Name + "' references invalid page index " + sprite.Page + ".");
            }

            if (sprite.W <= 0 || sprite.H <= 0 || sprite.SourceW <= 0 || sprite.SourceH <= 0)
            {
                throw new InvalidContentException("Sprite '" + sprite.Name + "' has invalid dimensions.");
            }

            SuwolAtlasPageContent page = pages[sprite.Page];

            if (sprite.X < 0 || sprite.Y < 0 || sprite.X + sprite.W > page.Width || sprite.Y + sprite.H > page.Height)
            {
                throw new InvalidContentException("Sprite '" + sprite.Name + "' rect is outside page '" + page.Image + "'.");
            }
        }
    }
}
