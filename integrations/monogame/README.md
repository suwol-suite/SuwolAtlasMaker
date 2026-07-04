# Suwol Atlas Maker MonoGame Integration

This integration loads Suwol Atlas Maker JSON and PNG page files directly at
runtime and also provides a MonoGame Content Pipeline importer.

## Project

The runtime is a regular C# class library:

```text
integrations/monogame/Suwol.AtlasMaker.MonoGame.csproj
```

It targets `net8.0` and references `MonoGame.Framework.DesktopGL`.

## Loading From Files

```csharp
using Suwol.AtlasMaker.MonoGame;

SuwolAtlas atlas = SuwolAtlasLoader.Load(
    GraphicsDevice,
    "Content/sample_atlas.json",
    "Content");
```

`Load(GraphicsDevice, jsonPath)` uses the JSON file's directory as the image
directory. `Load(GraphicsDevice, jsonPath, imageDirectory)` lets you keep JSON
and PNG page files in different folders.

For custom storage, use the stream API:

```csharp
SuwolAtlas atlas = SuwolAtlasLoader.Load(
    GraphicsDevice,
    jsonStream,
    imageName => OpenMyPageStream(imageName));
```

The loader validates JSON version, page count, texture dimensions, duplicate
sprite names, page indices, and source rectangles.

Optional project metadata from `{name}.metadata.json` can be loaded separately:

```csharp
SuwolAtlasMetadata metadata =
    SuwolAtlasMetadataLoader.Load("Content/metadata_demo.metadata.json");

string group = metadata.GetGroup("hero_idle");
string[] tags = metadata.GetTags("hero_idle");
bool isIdle = metadata.HasTag("hero_idle", "idle");
```

The sidecar loader does not replace the atlas loader. It only exposes editor
metadata such as source path, original name, group, tags, pivot, order, trim
mode, and crop.

## Loading From Content Pipeline

The pipeline extension is a separate buildable project:

```text
integrations/monogame/Suwol.AtlasMaker.MonoGame.Pipeline.csproj
```

It provides:

- `SuwolAtlasImporter`: imports exported atlas JSON.
- `SuwolAtlasProcessor`: validates version, pages, sprites, names, and rects.
- `SuwolAtlasWriter`: writes compiled atlas metadata.
- `SuwolAtlasReader`: runtime reader for `SuwolAtlasContent`.

Build it with:

```text
dotnet build integrations/monogame/Suwol.AtlasMaker.MonoGame.Pipeline.csproj
```

Then reference the built pipeline DLL from your `.mgcb`, build the exported
`{name}.json` with importer `SuwolAtlasImporter` and processor
`SuwolAtlasProcessor`, and build each page PNG with MonoGame's standard texture
pipeline.

Runtime usage:

```csharp
SuwolAtlasContent metadata = Content.Load<SuwolAtlasContent>("advanced_atlas");
Texture2D[] pages =
{
    Content.Load<Texture2D>("advanced_atlas")
};

SuwolAtlas atlas = SuwolAtlasLoader.FromContent(metadata, pages);
```

The pipeline importer rejects `.suwol-atlas.json` project files and expects the
exported atlas JSON with `pages[]` and `sprites[]`.
The optional `{name}.metadata.json` sidecar is not compiled by this MVP pipeline
extension; load it through `SuwolAtlasMetadataLoader` when tags/groups/order/
trim/crop are needed at runtime.

## Single Page And Multipack

Single-page output has one PNG:

```text
sample_atlas.png
sample_atlas.json
```

Multipack output has one JSON and multiple page PNGs:

```text
multipack_atlas_0.png
multipack_atlas_1.png
multipack_atlas.json
```

The MonoGame loader reads JSON `pages[].image` and loads the matching files from
the image directory. Each frame stores its `Page`, and drawing uses the matching
page texture.

## Frames And Rectangles

MonoGame `Rectangle` uses top-left texture coordinates, which matches Suwol
Atlas Maker JSON. No Unity-style Y conversion is needed.

```csharp
SuwolAtlasFrame frame = atlas.GetFrame("hero_idle_0");
Texture2D texture = atlas.GetPageTexture(frame.Page);
Rectangle source = frame.SourceRectangle;
```

Convenience APIs:

- `GetFrame(string name)`
- `TryGetFrame(string name, out SuwolAtlasFrame frame)`
- `GetSourceRectangle(string name)`
- `TryGetSourceRectangle(string name, out Rectangle rect)`
- `GetPageTexture(int page)`

## Drawing

Use the SpriteBatch extensions for simple drawing:

```csharp
spriteBatch.DrawAtlasSprite(
    atlas,
    "hero_idle_0",
    new Vector2(100, 100),
    Color.White);
```

The extended overload accepts rotation, scale, effects, and layer depth.

## Trim Metadata

The default draw helper draws the trimmed content rectangle. Original canvas
metadata is available on `SuwolAtlasFrame`:

- `SourceWidth` / `SourceHeight`
- `OffsetX` / `OffsetY`
- `Trimmed`
- `GetSourceSize()`
- `GetTrimOffset()`
- `GetPivotPixels()`

Offsets are measured from the original image's top-left origin.

## Rotated Sprites

Suwol Atlas Maker stores rotated frames as 90-degree clockwise pixels in the
atlas. `SuwolAtlasFrame.Rotated` exposes this metadata.

`DrawAtlasSprite` applies a draw-time rotation correction for rotated frames by
drawing with `rotation - MathHelper.PiOver2` and a position/scale adjustment.
This keeps the common content-rect draw path in normal orientation. Advanced
custom drawing code can inspect `frame.Rotated` and apply its own policy.

## Texture Ownership

The file and stream loaders create `Texture2D` instances with
`Texture2D.FromStream`. The returned `SuwolAtlas` owns those textures and
disposes them from `SuwolAtlas.Dispose()`. Call `Dispose()` when the atlas is no
longer needed.

## Sample

See:

- `Samples/BasicLoader`: direct file loading with `SuwolAtlasLoader.Load`.
- `Samples/ContentPipeline`: `.mgcb` and `Game` sample for Content Pipeline
  loading with `SuwolAtlasLoader.FromContent`.

## Not Included Yet

- advanced pipeline dependency automation
- automatic sidecar compilation into the Content Pipeline asset
