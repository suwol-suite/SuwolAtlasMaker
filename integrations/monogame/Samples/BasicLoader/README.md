# Basic Loader Sample

This sample shows direct runtime loading without the MonoGame Content Pipeline.

1. Export an atlas with Suwol Atlas Maker.
2. Copy the generated `.json` and page `.png` files next to your executable, or
   into a folder such as `Content`.
3. Add a reference to `Suwol.AtlasMaker.MonoGame`.
4. Set `AtlasJsonPath` to the JSON path.
5. Set `ImageDirectory` to the directory containing the page PNG files.
6. Set `SpriteName` to a sprite name from the JSON.

Example:

```csharp
atlas = SuwolAtlasLoader.Load(GraphicsDevice, "Content/multipack_atlas.json", "Content");
spriteBatch.DrawAtlasSprite(atlas, "long_vertical", new Vector2(100, 100), Color.White);
```

For multipack output, the loader reads `pages[].image` from the JSON and loads
every page texture from `ImageDirectory`.

The sample calls `atlas.Dispose()` in `UnloadContent`. This matters because the
file and stream loaders create `Texture2D` instances owned by the atlas.

Rotated frames are handled by `DrawAtlasSprite` through a draw-time rotation
correction. The helper draws the trimmed content rect; if you need original
canvas placement, use `frame.GetTrimOffset()` and `frame.GetSourceSize()`.
