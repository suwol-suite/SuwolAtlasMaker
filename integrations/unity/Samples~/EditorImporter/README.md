# Suwol Atlas Maker Editor Importer Sample

This sample shows the Unity Editor workflow for Suwol Atlas Maker atlas exports.

## Open The Viewer

1. Add `integrations/unity` as a local Unity package.
2. Open `Tools > Suwol Atlas Maker > Open Atlas Viewer`.
3. Assign the exported `{name}.json` atlas file as the Atlas JSON.
4. Click `Find Page Textures` to locate page PNG files next to the JSON.
5. Click `Validate`.

The viewer lists pages, sprites, trim metadata, rotation flags, source size,
offset, pivot, and validation messages.

## Texture Settings

If the atlas contains rotated sprites, page textures must have **Read/Write
Enabled** because the runtime rotates those regions back with `Texture2D.GetPixels`.

Use `Apply Recommended Settings` to set:

- Read/Write Enabled when rotated sprites exist
- Wrap Mode: Clamp
- Filter Mode: Point

Compression is reported as an info message so the project can choose its own
texture quality policy.

## Create A Runtime Asset

Click `Create/Update SuwolAtlasAsset` to create a ScriptableObject that stores:

- atlas JSON `TextAsset`
- page `Texture2D[]`
- pixels per unit

You can then reference that asset from gameplay scripts and call:

```csharp
SuwolAtlas atlas = atlasAsset.Load();
Sprite sprite = atlasAsset.CreateSprite("hero_idle_0");
```

Page texture order must match JSON `pages[]`, especially for multipack output.
