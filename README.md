# Suwol Atlas Maker

Suwol Atlas Maker is a Node.js and TypeScript CLI and Electron GUI for building
game-ready sprite atlases from PNG folders. The current core pipeline loads PNG files,
optionally trims transparent bounds, optionally extrudes edge pixels, optionally
uses 90-degree rotated placements, splits sprites across multiple atlas pages
when needed, can resize atlas pages to power-of-two dimensions, writes JSON
metadata, applies per-sprite project metadata, can write optional metadata
sidecars, records a packing log, watches inputs, caches input fingerprints, and
exports batches of project files. The GUI also supports visual pivot editing,
sprite ordering, and per-sprite trim/crop overrides.

## Install

Node.js 22 LTS is recommended for local development and matches the GitHub
Actions release runners.

```bash
npm install
npm run build
```

The CLI binary is named `suwol-atlas`.

## CLI Usage

```bash
suwol-atlas make ./samples/input ./samples/output --name sample_atlas --max-size 2048 --padding 2
```

With MaxRects packing:

```bash
suwol-atlas make ./samples/input ./samples/output --name sample_atlas --max-size 2048 --padding 2 --algorithm maxrects --clean
```

With cache and power-of-two sizing:

```bash
suwol-atlas make ./samples/input ./samples/output --name sample_atlas --algorithm maxrects --size-mode pot --cache --clean
```

Export from a project file:

```bash
suwol-atlas make --project ./samples/projects/metadata-demo.suwol-atlas.json
```

Editing metadata sample:

```bash
suwol-atlas make --project ./samples/projects/editing-demo.suwol-atlas.json
```

Watch an input folder:

```bash
suwol-atlas make ./samples/input ./samples/output --name sample_atlas --algorithm maxrects --watch
```

With trim, extrude, and rotate enabled:

```bash
suwol-atlas make ./samples/input ./samples/output --name sample_atlas --max-size 2048 --padding 2 --trim --extrude 1 --rotate --algorithm maxrects --clean
```

When running from this repository after a build:

```bash
node dist/cli/index.js make ./samples/input ./samples/output --name sample_atlas --max-size 2048 --padding 2
```

Options:

- `inputDir`: directory scanned recursively for `.png` files.
- `outputDir`: directory where generated files are written.
- `--name`: base output name. Default: `atlas`.
- `--max-size`: maximum atlas width and height. Default: `2048`.
- `--padding`: transparent pixels between packed draw areas. Default: `0`.
- `--algorithm shelf|maxrects`: packing algorithm. Default: `shelf`.
- `--size-mode tight|pot|square-pot`: final atlas page sizing. Default: `tight`.
- `--format json`: JSON metadata output. Other formats are not supported yet.
- `--trim` / `--no-trim`: enable or disable transparent-bound trimming. Default: disabled.
- `--extrude <pixels>`: duplicate edge pixels outward by a non-negative integer. Default: `0`.
- `--rotate` / `--no-rotate`: allow or disallow 90-degree rotated packing. Default: disabled.
- `--cache` / `--no-cache`: write and compare `.suwol-atlas-cache.json`. Default: disabled.
- `--watch`: keep the process alive and export after input PNG changes. Default: disabled.
- `--watch-debounce <ms>`: debounce window for watch changes. Default: `750`.
- `--clean`: remove the output directory before writing new files.
- `--project <file>`: export from a `.suwol-atlas.json` project file. Positional input/output paths can override project paths.
- `--metadata` / `--no-metadata`: force or disable `{name}.metadata.json` sidecar export.

For paired options such as `--trim` and `--no-trim`, the last option on the
command line wins. The same policy applies to `--rotate` and `--no-rotate`.

Batch export project files:

```bash
suwol-atlas batch ./samples/projects
suwol-atlas batch ./atlas-a.suwol-atlas.json ./atlas-b.suwol-atlas.json
```

Batch targets can be project files or directories. Directories are scanned
recursively for `.suwol-atlas.json` files. Failed projects are reported and the
remaining projects continue by default; use `--fail-fast` to stop after the
first failure. `--cache` and `--no-cache` can override each project's cache
setting for that batch run.

## GUI Usage

The Electron GUI wraps the same core export pipeline used by the CLI.

```bash
npm run build:gui
npm run start:gui
```

For a one-command build-and-run flow:

```bash
npm run dev:gui
```

In the GUI:

- choose an input folder
- choose an output folder
- set atlas name, max size, padding, packing algorithm, size mode, trim, extrude, rotate, cache, watch, and clean
- save and open `.suwol-atlas.json` project files
- choose a `generic`, `unity`, or `monogame` profile preset
- scan input sprites and edit include/exclude, export name, pivot, tags, and group metadata
- drag the pivot marker in the preview or use pivot presets
- filter, sort, and reorder input sprites through project metadata
- set per-sprite trim mode and manual crop rectangles
- run export
- run batch export over project files or project folders
- preview the generated atlas PNG
- switch between multipack pages
- zoom or fit the preview and inspect the selected sprite rect and pivot marker
- inspect sprite rects, trim/rotate flags, JSON-derived page indices, and the export log
- watch input folders and see the last watch trigger/auto-export result

The GUI does not implement separate packing or export logic. It calls the
existing `makeAtlas` core API through Electron IPC, so GUI output remains
compatible with CLI output, Unity Runtime Loader, and MonoGame Runtime Loader.

GUI settings are saved under Electron `userData` as
`suwol-atlas-maker-settings.json`. The renderer never uses Node filesystem APIs
directly; folder selection, export, log reading, preview file URLs, and opening
the output folder all go through the preload API.

The GUI menu includes:

- File > New Project
- File > Open Project
- File > Save Project
- File > Save Project As
- File > Open Output Folder
- Help > About

## Project Files

GUI project files use the `.suwol-atlas.json` extension. They store GUI input
folders, output folders, export options, selected profile, and sprite metadata:

```json
{
  "version": 1,
  "name": "character_atlas",
  "inputDir": "C:/Project/MyGame/Art/Sprites",
  "outputDir": "C:/Project/MyGame/Assets/Atlas",
  "options": {
    "maxSize": 2048,
    "padding": 2,
    "algorithm": "maxrects",
    "sizeMode": "pot",
    "cache": true,
    "watch": false,
    "trim": true,
    "extrude": 1,
    "rotate": true,
    "clean": true
  },
  "profile": "unity",
  "sprites": {
    "characters/hero/idle_0.png": {
      "include": true,
      "nameOverride": "hero_idle",
      "pivotX": 0.5,
      "pivotY": 0.85,
      "tags": ["hero", "idle"],
      "group": "hero",
      "order": 10,
      "trimMode": "manual",
      "crop": {
        "x": 4,
        "y": 6,
        "w": 48,
        "h": 40
      }
    }
  }
}
```

Project files are not atlas export JSON files. Atlas export JSON still uses the
stable `version: 1`, `pages[]`, and `sprites[]` format documented below.

`sprites` is keyed by PNG paths relative to `inputDir`, normalized with `/`.
Only `include`, `nameOverride`, and `pivotX/pivotY` affect atlas JSON. `tags`,
`group`, `order`, `trimMode`, `crop`, `sourcePath`, and `originalName` are kept
out of atlas JSON and are written to `{name}.metadata.json` when sidecar export
is enabled. If a project contains sidecar metadata such as tags, groups, order,
trim mode, or crop data, sidecar export is enabled by default unless
`--no-metadata` is used.

The recent project list is stored in Electron `userData`, deduplicated, sorted
newest first, pruned when files are missing, and capped at 10 entries.

## Profiles

Profiles are GUI presets only. They do not change the atlas JSON format.

- `generic`: `maxSize=2048`, `padding=2`, `algorithm=shelf`, `sizeMode=tight`, `cache=false`, `watch=false`, `trim=false`, `extrude=0`, `rotate=false`, `clean=true`
- `unity`: `maxSize=2048`, `padding=2`, `algorithm=maxrects`, `sizeMode=pot`, `cache=true`, `watch=false`, `trim=true`, `extrude=1`, `rotate=true`, `clean=true`
- `monogame`: `maxSize=2048`, `padding=2`, `algorithm=maxrects`, `sizeMode=pot`, `cache=true`, `watch=false`, `trim=true`, `extrude=1`, `rotate=false`, `clean=true`

MonoGame keeps rotation disabled by default for the most conservative draw path.
The runtime can still read rotated frames when a user enables rotate manually.
MonoGame uses `pot` by default in the GUI profile to favor predictable GPU
texture dimensions over the smallest possible atlas file.

## ZIP Packaging And GitHub Releases

Windows and Linux ZIP packaging is configured through `electron-builder` plus a
small ZIP script.

```bash
npm run icons:generate
npm run pack:win
npm run zip:win
npm run pack:linux
npm run zip:linux
```

- `pack:win` creates an unpacked Windows app under `release/win-unpacked`.
- `zip:win` creates `release/archives/SuwolAtlasMaker-0.1.0-win-x64.zip`.
- `pack:linux` creates an unpacked Linux app under `release/linux-unpacked`.
- `zip:linux` creates `release/archives/SuwolAtlasMaker-0.1.0-linux-x64.zip`.
- `dist:win` creates a Windows portable artifact under `release`.
- The packaged app includes `dist/electron`, `dist/core`, `dist/shared`, and `dist/renderer`.
- The preload script is bundled as `dist/electron/preload.cjs` for packaged Electron.
- The product name is `Suwol Atlas Maker`.
- The app id is `work.godwish.suwol-atlas-maker`.
- Release ZIP artifacts use `SuwolAtlasMaker-${version}-win-x64.zip` and
  `SuwolAtlasMaker-${version}-linux-x64.zip`.
- Brand icons live under `assets/brand`; packaged build icons live under `build`.

GitHub Actions release automation lives in `.github/workflows/release.yml`.
Pushing a matching version tag creates a GitHub Release and uploads both ZIPs:

```bash
git tag v0.1.0
git push origin v0.1.0
```

Manual release runs are also supported through workflow dispatch. See
[`docs/release.md`](docs/release.md) for the release workflow, tag policy,
artifact naming, and troubleshooting notes. Installer targets, code signing,
auto-update, AppImage, deb/rpm, snap, winget, store distribution, and macOS
builds are intentionally not part of this ZIP release MVP.

Useful scripts:

```bash
npm run icons:generate
npm run generate:samples
npm run generate:samples:advanced
npm run generate:samples:multipack
npm run generate:samples:packing
npm run generate:samples:batch
npm run generate:samples:metadata
npm run generate:samples:editing
npm run generate:samples:ux
npm run build
npm run build:gui
npm run build:unity-check
npm run build:monogame
npm run build:monogame:pipeline
npm run pack:win
npm run pack:linux
npm run zip:win
npm run zip:linux
npm run check:release-version
npm run dist:win
npm run typecheck
npm test
npm run sample
npm run sample:advanced
npm run sample:multipack
npm run sample:packing
npm run sample:pot
npm run sample:batch
npm run sample:metadata
npm run sample:editing
npm run sample:ux
npm run clean
```

## Output Files

For `--name sample_atlas`, the exporter writes:

- `sample_atlas.png`: transparent atlas PNG.
- `sample_atlas.json`: atlas metadata.
- `sample_atlas.metadata.json`: optional editor sidecar metadata.
- `sample_atlas.log.txt`: packing log and warnings.

When one page is enough, the PNG keeps the compatibility name:

- `{name}.png`

When more than one page is needed, page PNGs use indexed names:

- `{name}_0.png`
- `{name}_1.png`
- `{name}_2.png`

The JSON and log names stay `{name}.json` and `{name}.log.txt` in both cases.
Atlas size is reduced to the minimum used rectangle for the packed sprites.
When `--size-mode pot` or `--size-mode square-pot` is used, the final page is
expanded with transparent pixels after packing. Coordinates use top-left origin
in atlas PNG pixels.

## JSON Format

```json
{
  "version": 1,
  "name": "sample_atlas",
  "pages": [
    {
      "image": "sample_atlas.png",
      "width": 1024,
      "height": 1024
    }
  ],
  "sprites": [
    {
      "name": "hero_idle_0",
      "page": 0,
      "x": 10,
      "y": 20,
      "w": 128,
      "h": 96,
      "rotated": false,
      "trimmed": true,
      "sourceW": 160,
      "sourceH": 128,
      "offsetX": 16,
      "offsetY": 20,
      "pivotX": 0.5,
      "pivotY": 0.5
    }
  ]
}
```

Sprite names are file names without `.png`. Duplicate sprite names are rejected,
including duplicates from different subdirectories.

`pages[]` lists every atlas PNG in stable page order. Each sprite's `page`
field is a zero-based index into that array. If the sprite set exceeds
`--max-size` for one page, Suwol Atlas Maker automatically opens another page.
A single sprite whose trim/extrude draw size is larger than `--max-size` still
fails because no page can contain it.

JSON sprite rect policy:

- `x/y/w/h` describes the logical sprite rect on the atlas PNG.
- Extrude pixels exist in the atlas PNG but are not included in `w/h`.
- When `extrude` is greater than `0`, `x/y` points inside the drawn bitmap at the content start.
- When `rotated` is `false`, `w=contentW` and `h=contentH`.
- When `rotated` is `true`, `w=contentH` and `h=contentW` because the rect is on the atlas.
- `sourceW/sourceH` always records the original PNG size.
- `offsetX/offsetY` records the top-left trim offset in original PNG coordinates.
- `pivotX/pivotY` defaults to `0.5` and can be overridden by project sprite
  metadata.

Atlas JSON deliberately does not include project/editor-only fields such as
`sourcePath`, `originalName`, `tags`, `group`, `order`, `trimMode`, `crop`, or
`include`.

Trim uses alpha greater than `0` as visible content. A fully transparent image
is exported as a 1x1 transparent sprite with the original `sourceW/sourceH`
preserved and `trimmed: true`.

Extrude is different from padding. Extrude duplicates a sprite's own edge pixels
inside its draw area. Padding is transparent space between packed draw areas,
after extrude has already been included.

## Metadata Sidecar

Project sprite metadata is stored in `.suwol-atlas.json` project files:

```json
{
  "sprites": {
    "characters/hero/idle_0.png": {
      "include": true,
      "nameOverride": "hero_idle",
      "pivotX": 0.5,
      "pivotY": 0.85,
      "tags": ["hero", "idle"],
      "group": "hero",
      "order": 10,
      "trimMode": "manual",
      "crop": {
        "x": 4,
        "y": 6,
        "w": 48,
        "h": 40
      }
    }
  }
}
```

`trimMode` values:

- `default`: use the global trim option.
- `auto`: alpha-trim this sprite even if global trim is off.
- `none`: keep this sprite's full source PNG even if global trim is on.
- `manual`: use `crop` as a source-image-space rectangle.

Manual crop writes only existing atlas JSON fields: `offsetX`, `offsetY`,
`sourceW`, `sourceH`, `w`, `h`, and `trimmed`. Atlas JSON does not contain
`trimMode` or `crop`.

When sidecar export is enabled, Suwol Atlas Maker writes `{name}.metadata.json`:

```json
{
  "version": 1,
  "atlas": "metadata_demo",
  "sprites": [
    {
      "name": "hero_idle",
      "sourcePath": "characters/hero/idle_0.png",
      "originalName": "idle_0",
      "included": true,
      "group": "hero",
      "tags": ["hero", "idle"],
      "pivotX": 0.5,
      "pivotY": 0.85,
      "order": 10,
      "trimMode": "manual",
      "crop": {
        "x": 4,
        "y": 6,
        "w": 48,
        "h": 40
      }
    }
  ]
}
```

Sidecar export is automatic when a project contains tags, groups, order,
trimMode, or crop data. Use `--metadata` to force it or `--no-metadata` to
disable it. Excluded sprites are not written to atlas JSON or to the sidecar.

## Size Modes

- `tight`: keep the smallest used page size. This is the CLI default.
- `pot`: round each page width and height up independently to the next
  power-of-two.
- `square-pot`: round the larger page dimension up to the next power-of-two and
  use that value for both width and height.

Size modes do not move sprites. They only increase the transparent canvas area
after packing. If a rounded page would exceed `--max-size`, the export fails
clearly rather than silently repacking.

## Watch, Cache, And Batch

Watch mode observes input PNG changes and runs debounced exports. Output folder
changes are not watched, and watch mode refuses an output folder inside the
input folder to avoid export loops.

Cache mode writes `.suwol-atlas-cache.json` in the output folder. The cache
stores input file size, mtime, SHA-256 hash, dimensions, tool version, input
folder, and option hash. It is used for hit/miss reporting and future
incremental work; current exports still rebuild from current source images to
preserve correctness. Damaged cache files are ignored and regenerated.

Batch mode exports multiple `.suwol-atlas.json` project files. Relative paths
inside a project are resolved from the project file's folder, and each
project's `sprites` metadata map is applied during export. Watch mode with
`--project` reloads the project file before each export so saved sprite metadata
changes are picked up.

## Packing Algorithms

Suwol Atlas Maker supports two packers:

- `shelf`: deterministic shelf packing. This remains the default for backward
  compatibility and simple layouts.
- `maxrects`: MaxRects packing using a best-short-side-fit heuristic. This is
  usually more space-efficient for uneven sprite dimensions and works with
  padding, trim, extrude, rotate, and multipack.

The selected algorithm is recorded in the packing log and GUI/project settings,
but not in atlas export JSON. The export JSON schema remains stable so existing
Unity and MonoGame loaders can keep reading the same files.

The packing log includes the algorithm, sprite count, page count, per-page
atlas size, used area, atlas area, occupancy percentage, total occupancy,
rotated sprite count, trimmed sprite count, multipack status, size mode,
raw/final page sizes, and cache hit/miss details.
When sprite metadata is present, the log also records included/excluded counts,
renamed sprites, pivot overrides, tagged/grouped sprites, ordered sprites,
trim mode overrides, manual crop count, and the sidecar path.

## Unity Runtime

Unity runtime support lives in [`integrations/unity`](integrations/unity).
It is a Unity Package Manager-compatible local package named
`com.suwol.atlasmaker`.

Basic runtime flow:

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

Single-page usage:

- assign `{name}.json` as a Unity `TextAsset`
- assign `{name}.png` to `pages[0]`

Multipack usage:

- assign `{name}.json` as a Unity `TextAsset`
- assign `{name}_0.png` to `pages[0]`
- assign `{name}_1.png` to `pages[1]`
- keep the `Texture2D[] pages` order identical to JSON `pages[]`

The runtime converts Suwol Atlas Maker's top-left origin JSON rects into Unity's
bottom-left `Sprite.Create` rects using the texture for each sprite's `page`.
`pivotX/pivotY` are normalized and passed directly to Unity.

Trimmed sprites are created from the trimmed content rect. Original-canvas data
is available through `SuwolAtlasSprite.sourceW/sourceH`,
`offsetX/offsetY`, `trimmed`, `GetTrimOffsetPixels`, and
`GetSourceSizePixels`.

Rotated sprites are restored to normal orientation by copying the atlas rect
into a cached temporary `Texture2D` and rotating it back before `Sprite.Create`.
For rotated sprites, the relevant Unity texture import setting must have
**Read/Write Enabled** because the runtime uses `Texture2D.GetPixels`.
Non-rotated sprites use the atlas page texture directly.

The Unity package includes a sample MonoBehaviour under
`integrations/unity/Samples~/BasicLoader`.

Optional sidecar metadata can be loaded separately:

```csharp
SuwolAtlasMetadata metadata = SuwolAtlasMetadataLoader.Load(metadataJson);
string group = metadata.GetGroup("hero_idle");
bool isIdle = metadata.HasTag("hero_idle", "idle");
```

The sidecar loader also reads optional `order`, `trimMode`, and `crop` fields.

Unity Editor support is included under `integrations/unity/Editor`:

- open `Tools/Suwol Atlas Maker/Open Atlas Viewer`
- select an exported `{name}.json` TextAsset
- find page PNG textures next to the JSON automatically
- validate JSON version, page textures, sprite bounds, duplicate names, and
  rotated sprite texture requirements
- preview page textures and selected sprite rects
- optionally assign `{name}.metadata.json` to inspect sidecar group/tags/order/trim/crop
- apply recommended texture settings
- create a `SuwolAtlasAsset` helper asset that stores the JSON, page textures,
  and pixels-per-unit setting
- optionally enable `Tools/Suwol Atlas Maker/Postprocessor Settings` so the AssetPostprocessor
  applies recommended texture settings or creates/updates helper assets when
  exported atlas JSON is imported

`SuwolAtlasAsset.Load()` returns a runtime `SuwolAtlas`, and
`SuwolAtlasAsset.CreateSprite(name)` creates a sprite through the runtime
loader. The Editor Importer rejects `.suwol-atlas.json` project files and
expects exported atlas JSON containing `pages[]` and `sprites[]`.

## MonoGame Runtime

MonoGame runtime support lives in [`integrations/monogame`](integrations/monogame).
It is a regular C# class library:

```text
integrations/monogame/Suwol.AtlasMaker.MonoGame.csproj
```

Basic loading and drawing:

```csharp
using Suwol.AtlasMaker.MonoGame;

SuwolAtlas atlas = SuwolAtlasLoader.Load(
    GraphicsDevice,
    "Content/sample_atlas.json",
    "Content");

spriteBatch.DrawAtlasSprite(
    atlas,
    "hero_idle_0",
    new Vector2(100, 100),
    Color.White);
```

Single-page usage copies `{name}.json` and `{name}.png` into a runtime folder.
Multipack usage copies `{name}.json` and every `{name}_N.png` page. The loader
reads JSON `pages[].image` and opens the matching PNG files from the image
directory.

MonoGame source rectangles use top-left origin, matching Suwol Atlas Maker JSON:

```csharp
Rectangle source = atlas.GetSourceRectangle("hero_idle_0");
Texture2D texture = atlas.GetPageTexture(frame.Page);
```

Trim metadata is available on `SuwolAtlasFrame` through `SourceWidth`,
`SourceHeight`, `OffsetX`, `OffsetY`, `Trimmed`, `GetSourceSize()`,
`GetTrimOffset()`, and `GetPivotPixels()`.

Rotated sprites expose `frame.Rotated`. The `DrawAtlasSprite` helper applies a
draw-time correction for rotated frames using `rotation - MathHelper.PiOver2`
and a position/scale adjustment. Custom renderers can inspect the metadata and
apply their own policy.

The file and stream loaders create `Texture2D` instances with
`Texture2D.FromStream`; call `atlas.Dispose()` when done.

Optional sidecar metadata can be loaded separately:

```csharp
SuwolAtlasMetadata metadata =
    SuwolAtlasMetadataLoader.Load("Content/metadata_demo.metadata.json");

string group = metadata.GetGroup("hero_idle");
bool isIdle = metadata.HasTag("hero_idle", "idle");
```

The sidecar loader also reads optional `order`, `trimMode`, and `crop` fields.

MonoGame Content Pipeline support is included:

```text
integrations/monogame/Suwol.AtlasMaker.MonoGame.Pipeline.csproj
```

The pipeline extension provides:

- `SuwolAtlasImporter` for exported atlas JSON
- `SuwolAtlasProcessor` for version, page, sprite, duplicate-name, and rect
  validation
- `SuwolAtlasWriter` for compiled metadata
- `SuwolAtlasReader` in the runtime assembly
- `SuwolAtlasLoader.FromContent(metadata, textures)` to combine compiled
  metadata with `Texture2D` page assets loaded by `ContentManager`

See `integrations/monogame/Samples/ContentPipeline` for an example `.mgcb`.
Project files (`.suwol-atlas.json`) are intentionally rejected by the pipeline
importer; use the exported `{name}.json` file.

## Current Features

- Recursive PNG input scan.
- Duplicate sprite name validation.
- Optional transparent-bound trim.
- Optional edge-pixel extrude.
- Optional 90-degree rotated packing.
- Shelf and MaxRects packing with padding.
- Multipack support for both packing algorithms.
- Tight, power-of-two, and square power-of-two page sizing.
- CLI and GUI cache option with input fingerprint cache files.
- CLI and GUI watch mode with debounced auto export.
- CLI and GUI batch export for project files.
- Max texture size validation.
- Transparent atlas PNG export.
- JSON metadata export.
- Project sprite metadata for include/exclude, name override, pivot, tags, and group.
- Project sprite metadata for order, trim mode, and manual crop override.
- Optional `{name}.metadata.json` sidecar export for tags/groups/source paths/order/trim/crop.
- Packing log export with page occupancy statistics.
- Unity Runtime Loader package for JSON, PNG pages, and optional metadata sidecar.
- Unity Editor Importer, atlas viewer, validation report, texture settings helper, and `SuwolAtlasAsset`.
- Unity AssetPostprocessor MVP with default-off auto texture settings and helper asset creation.
- MonoGame Runtime Loader for JSON, PNG pages, and optional metadata sidecar.
- MonoGame Content Pipeline importer, processor, writer, reader, and `FromContent` helper.
- Electron + React GUI with project files, profiles, packing algorithm selection, size mode, cache, watch, batch export, recent projects, undo/redo, multi-select sprite metadata editing, metadata cleanup, visual source crop editing with drag/resize handles, visual pivot handles, reorder/filter controls, manual crop editor, preview zoom, sprite rect overlay, and pivot marker.
- Windows Electron packaging configuration.
- GitHub Actions CI and ZIP release automation for Windows x64 and Linux x64.
- Basic, advanced, multipack, packing comparison, power-of-two, metadata, editing, UX, and batch sample generation scripts.
- Generated brand icon assets.
- Automated tests for loader, preprocessing, packer, JSON, PNG output, CLI option parsing, GUI support utilities, project files, profiles, recents, and packaging metadata.

## Not Supported Yet

- advanced MonoGame pipeline dependency automation
- GUI batch scheduling
- drag-and-drop row reorder
- automatic algorithm selection
- installer packaging and code signing

## License

This project is licensed under the MIT License.

## Libraries And Licenses

- `commander` (MIT): CLI command and option parsing.
- `pngjs` (MIT): PNG decoding and encoding.
- `System.Text.Json` (MIT): MonoGame runtime and pipeline JSON parsing.
- `MonoGame.Framework.DesktopGL` (MS-PL): MonoGame runtime texture and drawing APIs.
- `dotnet-mgcb` / `MonoGame.Framework.Content.Pipeline` (MS-PL): MonoGame Content Pipeline importer, processor, and writer APIs.
- `electron` (MIT): desktop GUI shell.
- `electron-builder` (MIT): Windows unpacked and portable packaging.
- `archiver` (MIT): release ZIP archive generation.
- `react` (MIT): renderer UI components.
- `react-dom` (MIT): renderer mounting.
- `lucide-react` (ISC): renderer icon components.
- `vite` (MIT): renderer build pipeline.
- `@vitejs/plugin-react` (MIT): React support for Vite.
- `esbuild` (MIT): CommonJS preload bundle for Electron packaging.
- `typescript` (Apache-2.0): TypeScript compiler.
- `vitest` (MIT): test runner.
- `@types/node` (MIT): Node.js type definitions.
- `@types/pngjs` (MIT): PNG library type definitions.
- `@types/react` (MIT): React type definitions.
- `@types/react-dom` (MIT): React DOM type definitions.
