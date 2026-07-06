# Suwol Atlas Maker Architecture

The command line shell stays thin and reusable behavior lives under `src/core`.

- `src/cli` parses user input and prints success or failure messages.
- `src/core/image` finds PNG files, decodes them, and prepares sprite content.
- `src/core/packer` converts prepared sprite dimensions into one or more page placements.
- `src/core/sizing` applies final atlas page size modes after packing.
- `src/core/cache` reads and writes input fingerprint cache metadata.
- `src/core/metadata` validates project sprite metadata and resolves final
  included sprite names and pivots.
- `src/core/watch` debounces input change events and serializes auto exports.
- `src/core/batch` resolves project files and runs multiple exports.
- `src/core/exporters` writes PNG, JSON, and packing log outputs.
- `src/shared` contains small cross-cutting helpers.

## Image Preparation

PNG loading preserves the original bitmap as `LoadedImage`. A separate
preprocessing step converts each loaded image to `SpriteContent`.

- Trim disabled: content size is the original PNG size, offsets are `0,0`, and
  `trimmed` is `false`.
- Trim enabled: alpha greater than `0` defines visible content bounds. The
  content bitmap is cropped to those bounds, and `offsetX/offsetY` stores the
  content origin in original PNG coordinates.
- Fully transparent images become a 1x1 transparent content bitmap. Their
  original `sourceW/sourceH` values are preserved.

## Packer Input

Packers receive prepared content dimensions, not raw PNG dimensions. Packing
size is based on:

```text
drawW = contentW + extrude * 2
drawH = contentH + extrude * 2
```

When rotate is enabled, the packer also considers the swapped candidate:

```text
rotatedDrawW = drawH
rotatedDrawH = drawW
```

Padding is applied between draw areas, so it is outside trim and extrude. The
packer creates one or more pages as needed. A sprite that cannot fit on an
empty page fails with a max-size error.

`src/core/packer/packerFactory.ts` selects the implementation from
`PackOptions.algorithm`:

- `shelf`: deterministic shelf packing and the CLI default.
- `maxrects`: MaxRects packing using a best-short-side-fit heuristic.

Both implementations use the same `Packer` interface and return the same
page-centered result model. `maxrects` can reuse remaining free rectangles
inside a page, so it often packs uneven sprite dimensions into fewer pages than
the shelf packer.

## Size Modes

Packers produce raw used page sizes. `src/core/sizing/sizeMode.ts` then applies
the requested final page sizing:

- `tight`: raw used size.
- `pot`: width and height rounded independently to the next power-of-two.
- `square-pot`: larger side rounded to power-of-two and used for both sides.

This step changes only `PackPage.width/height`. Sprite coordinates and draw
rects stay unchanged. `PackPage.rawWidth/rawHeight` preserves the pre-sizing
value for logs. PNG and JSON exporters both read the final `width/height`, so
`pages[].width/height` always matches the actual PNG dimensions.

The pack result is page centered:

- `PackResult.pages`: stable page list, indexed from `0`.
- `PackPage.sprites`: sprites that belong to that page only.
- `PackResult.sprites`: flat sprite list in packing order for JSON and logs.

The pack result keeps the atlas draw rect separate from the exported JSON rect:

- `drawX/drawY/drawW/drawH`: actual bitmap region copied into the atlas PNG.
- `spriteX/spriteY/spriteW/spriteH`: logical sprite rect exported to JSON.
- `x/y/w/h`: compatibility aliases for the logical sprite rect.

## Export Coordinates

Coordinates use top-left origin in atlas PNG pixels.

- Extrude pixels are copied to the atlas PNG but excluded from JSON `w/h`.
- For non-rotated sprites, JSON `x/y` is `drawX + extrude`, `drawY + extrude`,
  and `w/h` is `contentW/contentH`.
- For rotated sprites, JSON `x/y` is still the inner content start after
  extrude. `w/h` is `contentH/contentW` because JSON rects describe atlas-space
  dimensions.
- `sourceW/sourceH` and `offsetX/offsetY` are always original-image restoration
  metadata.

The PNG exporter builds the final per-sprite bitmap in this order:

1. Start with prepared content bitmap.
2. Apply edge-pixel extrude if requested.
3. Rotate the extruded bitmap clockwise when `rotated` is `true`.
4. Copy the final bitmap to `drawX/drawY`.

When a power-of-two size mode expands a page, the added area remains transparent
because the PNG canvas is created at the final page size before sprites are
copied.

For one page, the PNG filename is `{name}.png`. For multiple pages, page PNGs
are `{name}_0.png`, `{name}_1.png`, and so on. The JSON exporter uses the same
page naming helper so `pages[].image` always matches the written files.

## Cache

Cache metadata lives in `.suwol-atlas-cache.json` under the output directory.
It records tool version, input directory, option hash, and per-input file
fingerprints:

- project-relative PNG path
- size
- `mtimeMs`
- SHA-256 hash
- decoded width and height

Cache comparison happens after PNG loading and before preprocessing. This keeps
exports correct even when the cache is damaged or stale. Current cache behavior
reports hit/miss and invalidation details, then writes fresh metadata after a
successful export. It does not skip PNG composition yet.

## Sprite Metadata

Project sprite metadata lives in `.suwol-atlas.json` under `sprites`. Keys are
PNG paths relative to the project input directory and normalized to `/`.

`src/core/metadata` applies editor metadata before preprocessing:

- `include=false` removes a source PNG from the export.
- `nameOverride` replaces the final sprite name before duplicate-name checks.
- `pivotX/pivotY` replace the atlas JSON pivot values.
- `order` changes pack/export order when present; sprites without order keep
  the existing packer ordering.
- `trimMode` chooses global trim, forced alpha trim, no trim, or manual crop on
  a per-sprite basis.
- `crop` is validated against source PNG dimensions and applied only when
  `trimMode` is `manual`.
- `tags` and `group` stay out of atlas JSON and are only used for sidecar
  metadata.

Final names are validated after include/name override resolution, so duplicate
source file stems can be fixed by metadata. If all sprites are excluded, export
fails with a clear error.

Manual crop is applied in `src/core/image/preprocess.ts`, after PNG loading and
metadata resolution but before packing. It crops the source bitmap passed to the
packer/exporter while preserving the original source dimensions in
`sourceW/sourceH` and writing the crop origin to `offsetX/offsetY`.

`{name}.metadata.json` is an optional sidecar with `version: 1`, the atlas name,
and one entry per included sprite. It stores final name, source path, original
name, group, tags, pivot values, order, trim mode, and crop values. The sidecar
is emitted automatically when a project contains sidecar metadata and can be
forced or disabled by CLI flags.

## Watch

`src/core/watch/watchAtlas.ts` owns the debounced export queue used by both CLI
and GUI watch modes. It coalesces rapid input events into one export and queues
one follow-up export if another change arrives while an export is running.

Watch mode observes the input folder only. It refuses an output folder inside
the input folder to avoid self-triggering export loops.

## Batch Export

`src/core/batch/batchExport.ts` accepts project files or directories. Directory
targets are scanned recursively for `.suwol-atlas.json` files. Each project is
normalized through the shared project schema, relative paths are resolved from
the project file location, and `makeAtlas` performs the actual export.

Batch export continues after failed projects by default and reports a summary at
the end. `--fail-fast` stops after the first failure.

## Clean Policy

`--clean` creates the output directory if needed and removes only generated
files for the current atlas name:

- `{name}.png`
- `{name}_0.png`, `{name}_1.png`, and other indexed page PNGs
- `{name}.json`
- `{name}.metadata.json`
- `{name}.log.txt`

Unrelated files in the output directory are left alone.

## Unity Integration

Unity runtime support is isolated from the Node.js CLI under
`integrations/unity`.

- `integrations/unity/package.json`: Unity Package Manager metadata.
- `integrations/unity/Runtime`: runtime data model, JSON loader, Sprite factory,
  and assembly definition.
- `integrations/unity/Samples~/BasicLoader`: sample MonoBehaviour and sample
  instructions.

The Unity runtime depends on the stable CLI JSON contract. It does not require a
separate Unity export format:

- `SuwolAtlasData`, `SuwolAtlasPage`, and `SuwolAtlasSprite` mirror JSON field
  names for Unity `JsonUtility`.
- `SuwolAtlasLoader.Load(TextAsset, Texture2D[])` validates version, page count,
  page texture dimensions, duplicate sprite names, page indices, and rect bounds.
- `SuwolAtlasMetadataLoader.Load(TextAsset)` optionally reads the separate
  `{name}.metadata.json` sidecar for tags/groups/source paths/order/trim/crop.
- `SuwolAtlas.CreateSprite(name)` converts top-left JSON rects to Unity
  bottom-left texture rects.
- Multipack is handled by using `frame.page` to select the matching page texture.
- Trim metadata remains available on `SuwolAtlasSprite`; the runtime creates the
  trimmed content Sprite and leaves original-canvas restoration to caller code.
- Rotated sprites are copied into cached temporary textures and rotated back
  before `Sprite.Create`. This requires Read/Write Enabled on page textures used
  by rotated frames.

Unity Editor support is isolated from runtime support:

- `Editor/SuwolAtlasEditorWindow.cs`: `Tools/Suwol Atlas Maker/Open Atlas Viewer`
  window, JSON selection, page preview, sprite metadata, validation output, and
  helper asset creation. It can also display optional sidecar tags/groups/order/trim/crop.
- `Editor/SuwolAtlasImportUtility.cs`: exported JSON parsing, adjacent page
  texture lookup, project-file rejection, and validation entry points.
- `Editor/SuwolAtlasTextureSettings.cs`: recommended texture importer settings.
- `Editor/SuwolAtlasValidationReport.cs`: error, warning, and info collection.
- `Editor/SuwolAtlasAssetPostprocessor.cs`: optional default-off import hook
  for exported atlas JSON, page texture settings, validation, and helper asset
  creation.
- `Editor/SuwolAtlasPostprocessorSettings.cs`: settings asset and
  `Tools/Suwol Atlas Maker/Postprocessor Settings` menu entry.
- `Runtime/SuwolAtlasAsset.cs`: ScriptableObject helper that stores `TextAsset`,
  page textures, and pixels-per-unit, then delegates to the runtime loader.

The Editor assembly is constrained to the Unity Editor platform. Runtime files
must not reference `UnityEditor`.

## MonoGame Integration

MonoGame runtime support is isolated under `integrations/monogame`.

- `Suwol.AtlasMaker.MonoGame.csproj`: buildable C# class library.
- `Runtime`: System.Text.Json data model, file/stream loader, atlas lookup,
  frame metadata, Content Pipeline reader/content model, and SpriteBatch draw
  helpers.
- `Samples/BasicLoader`: small `Game` subclass and instructions.
- `Samples/ContentPipeline`: `.mgcb` and `Game` sample for compiled metadata.

The MonoGame runtime also depends on the stable CLI JSON contract. No separate
MonoGame export profile is required:

- `SuwolAtlasData`, `SuwolAtlasPage`, and `SuwolAtlasSprite` use
  `JsonPropertyName` attributes matching the CLI JSON fields exactly.
- `SuwolAtlasLoader` loads JSON and page PNG streams, then creates `Texture2D`
  pages with `Texture2D.FromStream`.
- `SuwolAtlasMetadataLoader` optionally reads the separate
  `{name}.metadata.json` sidecar for tags/groups/source paths/order/trim/crop.
- `SuwolAtlas` owns textures created by the loader and disposes them in
  `Dispose()`. Future externally injected texture APIs should add an
  ownership flag rather than changing this behavior.
- MonoGame source rectangles use top-left origin, so JSON `x/y/w/h` maps
  directly to `Rectangle`.
- Multipack is handled by using `frame.Page` to select the page texture.
- Trim metadata remains on `SuwolAtlasFrame` for callers that need original
  canvas placement.
- Rotated frames expose `Rotated=true`; the SpriteBatch helper applies a
  draw-time rotation correction for the common content-rect draw path.

MonoGame Content Pipeline support is separated into its own project:

- `Suwol.AtlasMaker.MonoGame.Pipeline.csproj`: references the runtime project and
  MonoGame Content Pipeline assemblies.
- `Pipeline/SuwolAtlasImporter.cs`: imports exported atlas JSON and rejects
  `.suwol-atlas.json` project files.
- `Pipeline/SuwolAtlasProcessor.cs`: validates version, pages, sprites,
  duplicate names, page indices, and rect bounds.
- `Pipeline/SuwolAtlasWriter.cs`: writes metadata for
  `Runtime/SuwolAtlasReader.cs`.
- `SuwolAtlasLoader.FromContent`: combines compiled metadata with page textures
  loaded by `ContentManager`.

The pipeline project removes `Runtime/**/*.cs` and `Samples/**/*.cs` from its
own compile items so the runtime is consumed through the project reference.

## GUI Integration

The GUI is an Electron + React + TypeScript app inside the same repository.

- `src/electron/main.ts`: BrowserWindow creation, IPC handlers, settings file
  IO, folder dialogs, input sprite scanning, output folder opening, and calls to
  `makeAtlas`.
- `src/electron/preload.ts`: exposes a narrow `window.suwolAtlas` API with
  `contextIsolation: true` and `nodeIntegration: false`. It is bundled to
  `dist/electron/preload.cjs` for packaged Electron.
- `src/renderer`: React renderer, controls, preview, sprite table, and log view.
- `src/shared/gui-types.ts`: IPC-safe DTOs used by main, preload, tests, and
  renderer.
- `src/shared/gui-utils.ts`: pure option validation, settings normalization,
  preview page image extraction, and sprite filtering.
- `src/shared/project.ts`: project file schema normalization, profile presets,
  recent project utilities, dirty-state checks, and preview rect calculations.

IPC channels:

- `dialog:selectInputDirectory`
- `dialog:selectOutputDirectory`
- `atlas:export`
- `atlas:readJson`
- `atlas:readLog`
- `atlas:scanInput`
- `atlas:openOutputDirectory`
- `batch:selectTargets`
- `batch:export`
- `watch:start`
- `watch:stop`
- `settings:load`
- `settings:save`
- `project:new`
- `project:openDialog`
- `project:save`
- `project:saveAs`
- `project:loadFromPath`
- `recent:list`
- `recent:open`
- `app:getVersion`

The renderer never imports `fs`, `path`, or core packer modules. Export always
flows through main process IPC:

```text
renderer options -> preload -> main IPC -> makeAtlas -> JSON/log/preview paths -> renderer
```

Settings are saved below Electron `app.getPath("userData")` as
`suwol-atlas-maker-settings.json`. Corrupt settings fall back to defaults.
Settings include the last project path, recent project paths, selected profile,
preview zoom, size mode, cache/watch choices, and window size.

Project files are separate from export JSON files. A `.suwol-atlas.json`
project stores GUI workflow state:

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

The atlas export JSON keeps its own stable `version: 1`, `pages[]`, and
`sprites[]` contract. Project file `version` and export JSON `version` are not
coupled beyond both starting at `1`.

Profiles are GUI presets only. `generic`, `unity`, and `monogame` map to core
options before export. They do not create Unity-specific or MonoGame-specific
metadata, so both runtimes continue reading the same atlas JSON.

Preview pages are derived from JSON `pages[].image`; the GUI does not guess
single-page or multipack filenames. Main process converts those output paths to
safe file URLs for display.

Selected sprite highlight uses the exported sprite page and atlas-space
`x/y/w/h`. Fit mode renders overlay coordinates as percentages; actual/custom
zoom uses scaled pixel coordinates.

The GUI exposes the same packing algorithm, size mode, cache, and watch options
as the CLI. Project files and settings persist those choices, and profile
presets can change them, but atlas export JSON intentionally does not include
workflow fields.

GUI and CLI output consistency is a hard boundary. Any new GUI option must map
to the existing core options or extend core first.

## Electron Packaging And Release ZIPs

Packaging is configured in `package.json` through `electron-builder`.

- Product name: `Suwol Atlas Maker`
- App id: `work.godwish.suwol-atlas-maker`
- Main entry: `dist/electron/main.js`
- Release output: `release`
- Artifact pattern: `SuwolAtlasMaker-${version}-win-${arch}.${ext}`
- Linux artifact pattern: `SuwolAtlasMaker-${version}-linux-${arch}.${ext}`
- Windows icon: `build/icon.ico`
- Linux icon: `build/icon.png`
- Linux targets: `AppImage`, `tar.gz`
- ZIP release archives: `release/archives/SuwolAtlasMaker-${version}-win-x64.zip`
  and `release/archives/SuwolAtlasMaker-${version}-linux-x64.zip`

The package includes `dist/electron`, `dist/core`, `dist/shared`,
`dist/renderer`, `package.json`, and `LICENSE`. Runtime icon files are copied
through `extraResources` so the
BrowserWindow can use `build/icon.png` both during development and after
packaging.

The Electron main process is emitted as ESM, while the preload script is bundled
as CommonJS. This keeps package `type: module` for the app while avoiding ESM
preload loading issues in sandboxed packaged windows.

GitHub Actions release automation builds Windows and Linux unpacked outputs,
zips them with `scripts/zip-release.mjs`, uploads both ZIP files, and publishes
signed Linux AppImage/tar.gz artifacts with checksum files to GitHub Releases.
Version tags must match `package.json` as `v${version}`.

Linux AppImage auto-update is isolated in `src/electron/linuxUpdater.ts`. It is
gated to packaged Linux AppImage runs, exposes only IPC/preload APIs to the
renderer, and uses GitHub Releases metadata generated by electron-builder
(`latest-linux.yml` and `.AppImage.blockmap`).

Brand assets are generated by `scripts/generate-icons.mjs`:

- `assets/brand/icon-source.png`
- `assets/brand/icon.svg`
- `assets/brand/icon-256.png`
- `assets/brand/icon-512.png`
- `build/icon.ico`
- `build/icon.png`

## Packing Logs

Packing logs are generated from the shared `PackResult`, so both algorithms
report the same fields:

- selected algorithm
- selected size mode
- sprite count and page count
- per-page atlas size, used area, atlas area, and occupancy
- per-page raw and final size
- total used area, total atlas area, and total occupancy
- rotated and trimmed sprite counts
- whether multipack was used
- cache hit/miss and invalidation details

## GUI Editor State And History

The renderer treats GUI export settings and project sprite metadata as the
editor state. `src/shared/history.ts` keeps bounded snapshot history with undo,
redo, save-baseline dirty checks, and project-open reset behavior. The history
stores settings and metadata only; PNG/image preview data stays outside history.

Visual crop editing uses source PNG coordinates. The renderer asks the Electron
main process for a safe source image preview URL and then uses
`src/shared/crop-editing.ts` to map pointer positions to integer source pixels,
clamp move/resize operations, enforce a minimum 1x1 crop, and calculate pivot
positions inside the effective crop rect. Dragging is local while in progress
and commits metadata once on pointer release.

Source preview IPC is intentionally narrow. The renderer sends `inputDir` plus
a relative PNG path. The main process rejects absolute paths, `..` traversal,
and non-PNG paths before returning a file URL or auto-trim rectangle.
