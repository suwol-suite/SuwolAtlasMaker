# Suwol Atlas Maker Unity Runtime

This folder is a Unity package for loading Suwol Atlas Maker JSON and PNG page
textures at runtime.

## Install

Use Unity Package Manager and add this folder as a local package:

```text
integrations/unity
```

The package name is `com.suwol.atlasmaker`.

## Runtime Usage

```csharp
using Suwol.AtlasMaker;
using UnityEngine;

public sealed class Example : MonoBehaviour
{
    public TextAsset atlasJson;
    public Texture2D[] pages;
    public SpriteRenderer targetRenderer;

    private void Start()
    {
        SuwolAtlas atlas = SuwolAtlasLoader.Load(atlasJson, pages);
        targetRenderer.sprite = atlas.CreateSprite("hero_idle_0");
    }
}
```

For single-page output, assign the one atlas PNG to `pages[0]`. For multipack
output, assign every page texture in JSON order:

- `pages[0]` matches JSON `pages[0].image`
- `pages[1]` matches JSON `pages[1].image`
- `pages[2]` matches JSON `pages[2].image`

The loader validates JSON version, page count, page texture sizes, page indices,
duplicate sprite names, and sprite rect bounds.

Texture import notes:

- Texture Type can be `Default` or `Sprite (2D and UI)` because the runtime uses
  the imported `Texture2D` and creates Sprites in code.
- Disable compression if exact pixel colors matter.
- Enable **Read/Write Enabled** for page textures that contain rotated sprites.

## API

- `SuwolAtlasLoader.Load(TextAsset json, Texture2D[] pages)`
- `SuwolAtlasLoader.Load(TextAsset json, Texture2D[] pages, float pixelsPerUnit)`
- `SuwolAtlasMetadataLoader.Load(TextAsset metadataJson)`
- `SuwolAtlasAsset.Load()`
- `SuwolAtlasAsset.CreateSprite(string spriteName)`
- `atlas.CreateSprite(string spriteName)`
- `atlas.TryCreateSprite(string spriteName, out Sprite sprite)`
- `atlas.GetFrame(string spriteName)`
- `atlas.TryGetFrame(string spriteName, out SuwolAtlasSprite frame)`
- `atlas.GetPageTexture(int page)`
- `atlas.GetTrimOffsetPixels(string spriteName)`
- `atlas.GetSourceSizePixels(string spriteName)`
- `atlas.ClearCache()`

`CreateSprite` caches generated sprites. Repeated calls with the same name return
the cached `Sprite`. `ClearCache` releases cached sprites and temporary rotated
textures.

## Metadata Sidecar

The regular atlas loader reads `{name}.json` and page textures. Optional project
metadata from `{name}.metadata.json` is loaded separately:

```csharp
SuwolAtlasMetadata metadata = SuwolAtlasMetadataLoader.Load(metadataJson);
string group = metadata.GetGroup("hero_idle");
string[] tags = metadata.GetTags("hero_idle");
bool isIdle = metadata.HasTag("hero_idle", "idle");
```

Sidecar data includes final sprite name, source path, original name, group,
tags, pivot, order, trim mode, and crop. These fields are not required for
normal sprite creation.

## Coordinates

Suwol Atlas Maker JSON uses top-left origin. Unity `Sprite.Create` uses a
bottom-left texture rect. The runtime converts each frame with:

```csharp
float unityY = texture.height - frame.y - frame.h;
Rect rect = new Rect(frame.x, unityY, frame.w, frame.h);
```

The conversion always uses the texture for `frame.page`.

## Pivot

JSON `pivotX` and `pivotY` are normalized values. The runtime passes them
directly to Unity `Sprite.Create`. The default CLI output is centered at
`0.5, 0.5`.

## Trim Metadata

`CreateSprite(name)` creates a Sprite from the atlas logical rect. If the source
image was trimmed, the Sprite is the trimmed content rectangle.

Original-canvas restoration metadata remains available:

- `frame.sourceW` / `frame.sourceH`: original PNG size
- `frame.offsetX` / `frame.offsetY`: content start in original top-left origin
- `frame.trimmed`: whether trimming changed the sprite

Use `GetTrimOffsetPixels` and `GetSourceSizePixels`, or read the frame directly,
when custom UI or rendering code needs to place trimmed content back into the
original canvas.

## Rotated Sprites

When `frame.rotated` is `true`, the atlas PNG stores that region rotated 90
degrees. The runtime extracts the atlas rect, rotates it back into logical
orientation in a temporary `Texture2D`, and creates the Sprite from that
temporary texture. The temporary texture is cached per sprite.

Unity requires page textures used by rotated sprites to have **Read/Write
Enabled** because the runtime uses `Texture2D.GetPixels`. Non-rotated sprites
use the atlas page texture directly.

## Editor Importer

Open the atlas viewer from:

```text
Tools/Suwol Atlas Maker/Open Atlas Viewer
```

The Editor window supports exported atlas JSON from the CLI or GUI. It does not
consume `.suwol-atlas.json` project files.

Workflow:

1. Select the exported `{name}.json` TextAsset.
2. Optionally assign `{name}.metadata.json` as the Metadata JSON TextAsset.
3. Let the window find page PNG textures next to the JSON.
4. Review validation errors, warnings, and info messages.
5. Preview page textures and selected sprite metadata.
6. Apply recommended texture settings when needed.
7. Create a `SuwolAtlasAsset` helper asset for runtime loading.

Validation checks include JSON version, page count, missing textures, page size
mismatches, duplicate sprite names, invalid page indices, sprite rect bounds,
trim metadata, and rotated sprite Read/Write requirements.

`SuwolAtlasAsset` stores the atlas JSON, page textures, and pixels-per-unit
setting. At runtime, call `asset.Load()` to get a `SuwolAtlas` or
`asset.CreateSprite(name)` for a direct sprite lookup.

## AssetPostprocessor

The package includes an optional AssetPostprocessor MVP:

```text
Tools/Suwol Atlas Maker/Settings
Tools/Suwol Atlas Maker/Postprocessor Settings
Tools/Suwol Atlas Maker/Validate Selected Atlas
Tools/Suwol Atlas Maker/Create Atlas Asset From Selected
```

The settings asset controls:

- auto applying recommended page texture settings
- auto creating or updating `SuwolAtlasAsset`
- pixels per unit for generated helper assets
- generated asset suffix and output folder policy
- verbose logging

The postprocessor itself and both automatic options are off by default. The
postprocessor only handles exported atlas JSON with `version`, `pages`, and
`sprites`, skips `.suwol-atlas.json` project files, and creates helper assets as
`{atlasName}.suwol-atlas.asset` by default.

## Samples

Open the package samples:

- `Samples~/BasicLoader`: assigns JSON and textures manually.
- `Samples~/EditorImporter`: uses a `SuwolAtlasAsset` created by the Editor
  viewer.

## Not Included Yet

- automatic sidecar asset binding
