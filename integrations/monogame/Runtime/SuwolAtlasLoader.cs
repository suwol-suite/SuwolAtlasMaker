using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using Microsoft.Xna.Framework.Graphics;

namespace Suwol.AtlasMaker.MonoGame
{
    public static class SuwolAtlasLoader
    {
        public static SuwolAtlas FromContent(SuwolAtlasContent content, Texture2D[] pages)
        {
            if (content == null)
            {
                throw new ArgumentNullException("content");
            }

            if (pages == null)
            {
                throw new ArgumentNullException("pages");
            }

            return new SuwolAtlas(content.ToAtlasData(), pages, false);
        }

        public static SuwolAtlas Load(GraphicsDevice graphicsDevice, string jsonPath)
        {
            if (string.IsNullOrEmpty(jsonPath))
            {
                throw new ArgumentException("JSON path must not be empty.", "jsonPath");
            }

            string fullJsonPath = Path.GetFullPath(jsonPath);
            string imageDirectory = Path.GetDirectoryName(fullJsonPath);

            if (string.IsNullOrEmpty(imageDirectory))
            {
                imageDirectory = Directory.GetCurrentDirectory();
            }

            return Load(graphicsDevice, fullJsonPath, imageDirectory);
        }

        public static SuwolAtlas Load(GraphicsDevice graphicsDevice, string jsonPath, string imageDirectory)
        {
            if (graphicsDevice == null)
            {
                throw new ArgumentNullException("graphicsDevice");
            }

            if (string.IsNullOrEmpty(jsonPath))
            {
                throw new ArgumentException("JSON path must not be empty.", "jsonPath");
            }

            if (string.IsNullOrEmpty(imageDirectory))
            {
                throw new ArgumentException("Image directory must not be empty.", "imageDirectory");
            }

            using (Stream jsonStream = File.OpenRead(jsonPath))
            {
                return Load(graphicsDevice, jsonStream, delegate (string imageName)
                {
                    string imagePath = Path.Combine(imageDirectory, imageName);
                    return File.OpenRead(imagePath);
                });
            }
        }

        public static SuwolAtlas Load(
            GraphicsDevice graphicsDevice,
            Stream jsonStream,
            Func<string, Stream> pageStreamProvider)
        {
            if (graphicsDevice == null)
            {
                throw new ArgumentNullException("graphicsDevice");
            }

            if (jsonStream == null)
            {
                throw new ArgumentNullException("jsonStream");
            }

            if (pageStreamProvider == null)
            {
                throw new ArgumentNullException("pageStreamProvider");
            }

            SuwolAtlasData data = JsonSerializer.Deserialize<SuwolAtlasData>(
                jsonStream,
                new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = false
                });

            if (data == null)
            {
                throw new ArgumentException("Failed to parse Suwol Atlas Maker JSON.", "jsonStream");
            }

            if (data.Pages == null || data.Pages.Length == 0)
            {
                throw new ArgumentException("Suwol Atlas Maker JSON must contain at least one page.", "jsonStream");
            }

            List<Texture2D> textures = new List<Texture2D>();

            try
            {
                for (int i = 0; i < data.Pages.Length; i++)
                {
                    SuwolAtlasPage page = data.Pages[i];

                    if (page == null || string.IsNullOrEmpty(page.Image))
                    {
                        throw new ArgumentException("JSON page image is missing at index " + i + ".");
                    }

                    using (Stream pageStream = pageStreamProvider(page.Image))
                    {
                        if (pageStream == null)
                        {
                            throw new InvalidOperationException("Page stream provider returned null for image '" + page.Image + "'.");
                        }

                        textures.Add(Texture2D.FromStream(graphicsDevice, pageStream));
                    }
                }

                return new SuwolAtlas(data, textures.ToArray(), true);
            }
            catch
            {
                for (int i = 0; i < textures.Count; i++)
                {
                    if (textures[i] != null)
                    {
                        textures[i].Dispose();
                    }
                }

                throw;
            }
        }
    }
}
