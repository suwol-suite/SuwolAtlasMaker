using System.IO;
using System.Text.Json;
using Microsoft.Xna.Framework.Content.Pipeline;

namespace Suwol.AtlasMaker.MonoGame.Pipeline
{
    [ContentImporter(".json", DisplayName = "Suwol Atlas Maker Atlas JSON", DefaultProcessor = "SuwolAtlasProcessor")]
    public sealed class SuwolAtlasImporter : ContentImporter<SuwolAtlasContent>
    {
        public override SuwolAtlasContent Import(string filename, ContentImporterContext context)
        {
            string json = File.ReadAllText(filename);

            if (LooksLikeProjectFile(json))
            {
                throw new InvalidContentException(
                    "This file looks like a .suwol-atlas.json project file. The MonoGame Content Pipeline importer expects exported atlas JSON with pages[] and sprites[].");
            }

            SuwolAtlasContent content = JsonSerializer.Deserialize<SuwolAtlasContent>(
                json,
                new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = false
                });

            if (content == null)
            {
                throw new InvalidContentException("Failed to parse Suwol Atlas Maker atlas JSON.");
            }

            context.Logger.LogMessage("Imported Suwol Atlas Maker atlas JSON: {0}", filename);
            return content;
        }

        private static bool LooksLikeProjectFile(string json)
        {
            return json.Contains("\"inputDir\"") &&
                json.Contains("\"outputDir\"") &&
                json.Contains("\"options\"") &&
                json.Contains("\"profile\"") &&
                !json.Contains("\"sprites\"");
        }
    }
}
