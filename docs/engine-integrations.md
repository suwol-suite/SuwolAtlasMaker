# Engine Integrations

Suwol Atlas Maker exports one stable atlas JSON format. Unity and MonoGame
integrations consume that export directly; they do not introduce engine-specific
export schemas.

Unity and MonoGame integrations are distributed as repository source under
`integrations/`. GitHub Release ZIPs are editor-only Electron app packages and
do not include `integrations/unity`, `integrations/monogame`, samples, tests,
docs, or source folders. If a separate engine integration artifact becomes
needed later, it should be published separately from the editor ZIPs.

## Unity

Runtime package:

```text
integrations/unity
```

Use this folder as a Unity Package Manager local or git package. It is not
bundled into GitHub Release ZIP files.

Runtime options:

- assign `{name}.json` as a `TextAsset`
- assign page PNG textures in JSON `pages[]` order
- call `SuwolAtlasLoader.Load(json, pages)`
- or create a `SuwolAtlasAsset` and call `asset.Load()`
- optionally load `{name}.metadata.json` with
  `SuwolAtlasMetadataLoader.Load(metadataJson)`

Editor workflow:

```text
Tools/Suwol Atlas Maker/Open Atlas Viewer
```

The Editor viewer validates exported JSON, finds page textures beside the JSON,
shows page and sprite metadata, previews sprite rectangles, displays optional
sidecar group/tags/order/trim/crop, applies recommended texture settings, and creates
`SuwolAtlasAsset` helper assets.

The Editor importer rejects `.suwol-atlas.json` project files. Select the
exported `{name}.json` file containing `pages[]` and `sprites[]`.

AssetPostprocessor MVP:

- `Tools/Suwol Atlas Maker/Postprocessor Settings` creates/selects a settings asset.
- `Tools/Suwol Atlas Maker/Validate Selected Atlas` validates the selected exported atlas JSON.
- `Tools/Suwol Atlas Maker/Create Atlas Asset From Selected` creates or updates a helper asset manually.
- `enablePostprocessor`, auto texture settings, and auto `SuwolAtlasAsset`
  creation are off by default.
- generated helper assets use `{atlasName}.suwol-atlas.asset` by default.
- imported JSON is processed only when it looks like exported atlas JSON with
  `version`, `pages`, and `sprites`.
- `.suwol-atlas.json` project files are skipped.

Optional metadata sidecar usage:

```csharp
SuwolAtlasMetadata metadata = SuwolAtlasMetadataLoader.Load(metadataJson);
string group = metadata.GetGroup("hero_idle");
string[] tags = metadata.GetTags("hero_idle");
bool isIdle = metadata.HasTag("hero_idle", "idle");
```

`SuwolAtlasMetadataSprite` also exposes optional `order`, `trimMode`, and
`crop` data from the sidecar.

## MonoGame

Runtime project:

```text
integrations/monogame/Suwol.AtlasMaker.MonoGame.csproj
```

Use this folder as source to build or reference from your MonoGame project. It
is not bundled into GitHub Release ZIP files.

Direct file loading:

```csharp
SuwolAtlas atlas = SuwolAtlasLoader.Load(
    GraphicsDevice,
    "Content/sample_atlas.json",
    "Content");
```

Optional metadata sidecar:

```csharp
SuwolAtlasMetadata metadata =
    SuwolAtlasMetadataLoader.Load("Content/character_atlas.metadata.json");

string group = metadata.GetGroup("hero_idle");
bool hasTag = metadata.HasTag("hero_idle", "idle");
```

`SuwolAtlasMetadataSprite` also exposes optional `Order`, `TrimMode`, and
`Crop` data from the sidecar.

Content Pipeline project:

```text
integrations/monogame/Suwol.AtlasMaker.MonoGame.Pipeline.csproj
```

Pipeline flow:

1. Build the pipeline project.
2. Reference the pipeline DLL from `.mgcb`.
3. Build exported atlas JSON with `SuwolAtlasImporter` and
   `SuwolAtlasProcessor`.
4. Build page PNGs with the standard MonoGame texture pipeline.
5. Load metadata as `SuwolAtlasContent` and textures as `Texture2D`.
6. Call `SuwolAtlasLoader.FromContent(metadata, pages)`.

The pipeline importer also rejects `.suwol-atlas.json` project files and expects
the exported `{name}.json` atlas metadata.

The metadata sidecar is separate from Content Pipeline atlas metadata in this
MVP. Load `{name}.metadata.json` through the runtime loader when you need
tags/groups/order/trim/crop.

## Validation Commands

```bash
npm run build:unity-check
npm run build:monogame
npm run build:monogame:pipeline
```
