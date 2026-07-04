# Suwol Atlas Maker MonoGame Content Pipeline Sample

This sample shows the Content Pipeline path for Suwol Atlas Maker atlas exports.
The metadata JSON is imported by `SuwolAtlasImporter`, processed by
`SuwolAtlasProcessor`, and loaded at runtime as `SuwolAtlasContent`.

## Files

- `Content.mgcb`: example MGCB entries for an exported atlas JSON and page PNG.
- `ContentPipelineAtlasGame.cs`: small `Game` subclass that combines pipeline
  metadata with page textures from `ContentManager`.

## Setup

1. Build the runtime project:

   ```text
   dotnet build integrations/monogame/Suwol.AtlasMaker.MonoGame.csproj
   ```

2. Build the pipeline extension:

   ```text
   dotnet build integrations/monogame/Suwol.AtlasMaker.MonoGame.Pipeline.csproj
   ```

3. Reference the pipeline DLL from your `.mgcb`.
4. Add the exported atlas JSON with importer `SuwolAtlasImporter` and processor
   `SuwolAtlasProcessor`.
5. Add every atlas page PNG with MonoGame's standard texture importer.
6. At runtime, load `SuwolAtlasContent` and the page `Texture2D` assets, then
   call `SuwolAtlasLoader.FromContent(metadata, textures)`.

Project files (`.suwol-atlas.json`) are not atlas exports. Use the generated
`{name}.json` file that contains `pages[]` and `sprites[]`.
