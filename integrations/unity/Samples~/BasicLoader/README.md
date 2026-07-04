# Basic Loader Sample

This sample shows the runtime loading flow for Suwol Atlas Maker output.

1. Export an atlas with the CLI.
2. Copy the generated JSON and PNG page files into your Unity project.
3. Select each PNG texture in Unity. Texture Type can be `Default` or `Sprite (2D and UI)`.
4. For rotated sprites, enable **Read/Write Enabled** on the page texture.
5. Add `SuwolAtlasBasicExample` to a GameObject with a `SpriteRenderer`.
6. Assign the JSON as a `TextAsset`.
7. Assign the PNG textures to `pages` in the same order as `pages[]` in the JSON.
8. Set `spriteName`, or leave it empty to display the first sprite.

For multipack output, `pages[0]` must be the texture named by JSON
`pages[0].image`, `pages[1]` must match `pages[1].image`, and so on.
