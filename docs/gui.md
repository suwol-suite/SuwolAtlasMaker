# Suwol Atlas Maker GUI

The GUI is an Electron shell around the existing Suwol Atlas Maker core. It
does not have a separate packer, exporter, or JSON format.

## Commands

```bash
npm run build:gui
npm run start:gui
```

Development convenience:

```bash
npm run dev
npm run dev:gui
```

`dev` is an alias for `dev:gui`. `dev:gui` builds the Electron main/preload
code and the Vite renderer, then starts Electron from `dist/electron/main.js`.

## Screen Structure

- Top bar: compact product name/version, Project/Sprites/Status panel toggles,
  and the language selector.
- Project Setup: project file path, open/save/save as, recent item lists,
  input/output folders, target profile, recommended
  settings, Advanced Settings, export readiness, Open Output, and the primary
  Export button.
- Atlas Preview: Quick Start empty-state guidance, sample project entry,
  zoom out, fit, actual size, zoom in, page tabs, selected sprite rect overlay,
  draggable pivot marker, and page metadata.
- Sprites panel: right-side tabs for `List`, `Selected`, `Filters`, and
  `Batch`. It is closed by default.
- Status: a compact bottom line by default, expandable when guided fixes,
  detailed export text, or the export result card is needed.
- Resizable splitters: Project width, Sprites width, and Status height can be
  dragged. Double-clicking a splitter resets its
  default size.
- Batch result panel: project-level success and failure summary.

The default workspace opens with Project visible, Sprites hidden, and Status
collapsed. The Preview guide is the primary first-run surface: choose a PNG
folder, choose an output folder, optionally open the sample project in a
development checkout, then export. Packaged editor ZIPs do not include samples;
the sample button reports a friendly message when the sample project is not
available.

## Security Boundary

The Electron window is created with:

- `contextIsolation: true`
- `nodeIntegration: false`

Renderer code talks to the main process through `window.suwolAtlas`, exposed by
`src/electron/preload.ts`. The renderer does not use Node `fs`, `path`, shell
execution, or direct core imports.

## Export Flow

1. Renderer validates fields.
2. Renderer calls `window.suwolAtlas.exportAtlas(options)`.
3. Main process validates again.
4. Main process calls `makeAtlas`.
5. Main process appends the selected GUI profile to the log.
6. Main process validates the generated JSON, page PNGs, sprite rects,
   metadata sidecar names, and loader-required fields.
7. Main process reads JSON pages and returns preview file URLs, validation
   status, metadata counts, and elapsed time.
8. Renderer reads JSON/log through preload API and updates preview, sprite list,
   Status details, recent folders, and the export result card.

The selected profile is a GUI preset and log hint. It does not change the atlas
JSON format.

After a successful export, the expanded Status panel shows an export result
card with success state, atlas name, page count, sprite count, output folder,
generated PNG/JSON/metadata/log files, selected profile, algorithm, size mode,
elapsed time, and export validation status. The card buttons open the output
folder, show JSON, show the log, or export again. Clicking the sprite count
opens the Sprites panel.

## Help And Error Guidance

Help > Guide opens an in-app guide with tabs for Quick Start, Basic Usage,
Unity, MonoGame, Troubleshooting, and File Guide. Help > Troubleshooting opens
the same guide directly on the troubleshooting tab.

Common GUI errors show a short message plus one or more suggested fixes in the
Status area. Technical messages are still kept in the expanded Status details.
The renderer does not inspect files directly for these actions; export, log
read, output folder open, cache cleanup, and recent cleanup stay behind the
preload API.

## Project Files

Project files use the `.suwol-atlas.json` extension and store GUI workflow
state:

- `version: 1`
- `name`
- `inputDir`
- `outputDir`
- `options.maxSize`
- `options.padding`
- `options.algorithm`
- `options.sizeMode`
- `options.cache`
- `options.watch`
- `options.trim`
- `options.extrude`
- `options.rotate`
- `options.clean`
- `profile`
- `sprites`

These files are opened and saved by the Electron main process. The renderer
requests project IO through preload IPC and never reads the filesystem directly.
Project files are separate from atlas export JSON; loaders should continue to
read `{name}.json` outputs, not `.suwol-atlas.json` files.

Damaged or incomplete project files are normalized with warnings where possible.
Invalid JSON is reported as a project load error.

## Sprite Metadata Editor

The GUI can scan the input folder before export through `atlas:scanInput`. The
scan runs in the Electron main process and returns DTOs to the renderer:

- relative source path
- original file stem
- PNG width and height
- source width and height
- auto trim rectangle when visible pixels exist
- include state
- final export name
- order
- pivot values
- trim mode and crop rectangle
- tags and group
- metadata status

The `Selected` tab supports include/exclude, name override, pivot X/Y,
group, comma-separated tags, order, trim mode, manual crop inputs, source
preview, crop reset, and pivot reset. When no sprite is selected it shows an
empty-state message instead of a blank editor.

The `List` tab contains the searchable input sprite table, simple
include/group/tag/trim filters, selection count, and exported rect table. When
no input folder is selected, or no scan result exists yet, the tab shows a
compact guide instead of bulk edit controls. The `Filters` tab contains
advanced include/group/tag/trim filters, name-override and crop filters,
invalid/missing filters, and sort controls. Rows in the input sprite table can
be reordered by drag and drop. The same order metadata can be changed with Top,
Up, Down, and Bottom controls in the Batch tab for keyboard-friendly fallback.
Filtered reorder updates visible rows while keeping hidden rows in their
existing order as much as possible.

The `Batch` tab contains batch set management, a project list with add/remove
controls, batch export, batch results, selected bulk actions, and metadata
cleanup. Scheduled runs are shown as unsupported and disabled.

Manual crop tools:

- `Default`, `Auto Trim`, `No Trim`, and `Manual Crop` trim modes.
- numeric `x`, `y`, `w`, `h` crop inputs in source PNG coordinates.
- `Use Full Image`, `Use Auto Trim`, `Reset Crop`, and `Validate Crop`.
- source PNG preview loaded through the preload IPC API.
- visual crop rectangle move and resize handles in source PNG coordinates.
- source-preview pivot marker editing inside the effective crop/trim rect.

Metadata changes are stored in the project `sprites` map and mark the project
dirty. The renderer still does not use Node filesystem APIs.

## Undo And Redo

The renderer keeps a bounded project-editor history of export options and
sprite metadata. Ctrl+Z and Ctrl+Y move through that history. Saving marks the
current snapshot as the clean baseline,
so undoing back to that snapshot clears the dirty state. Opening or creating a
project resets history.

Bulk actions, cleanup, visual crop commit, and pivot commit are pushed as single
history entries. While export is running, undo/redo and metadata writes are
ignored to avoid changing the export snapshot mid-run.

## Profiles

Profiles are option presets for the GUI:

- `generic`: `maxSize=2048`, `padding=2`, `algorithm=maxrects`, `sizeMode=tight`, `cache=false`, `watch=false`, `trim=true`, `extrude=1`, `rotate=false`, `clean=true`
- `unity`: `maxSize=2048`, `padding=2`, `algorithm=maxrects`, `sizeMode=pot`, `cache=true`, `watch=false`, `trim=true`, `extrude=1`, `rotate=true`, `clean=true`
- `monogame`: `maxSize=2048`, `padding=2`, `algorithm=maxrects`, `sizeMode=pot`, `cache=true`, `watch=false`, `trim=true`, `extrude=1`, `rotate=false`, `clean=true`

MonoGame keeps rotation disabled by default for a conservative drawing path.
Users can still enable rotation manually, and the MonoGame runtime can read
rotated metadata.

Use recommended settings can be enabled so changing profiles immediately applies
the matching preset. Users can also leave it off and click Apply Recommended
Settings manually. The Basic area prioritizes the target profile while Advanced
Settings keeps algorithm, size mode, cache, and watch controls tucked away.

## Watch

The Watch toggle starts and stops a main-process watcher for the selected input
folder. The renderer does not access the filesystem directly. Watch mode:

- runs an initial export
- debounces rapid PNG changes
- queues one follow-up export if a change happens while export is running
- keeps watching after export errors
- restarts when input/output/name/options change

Watch mode refuses an output folder inside the input folder to avoid loops.

## Batch Export

Batch Export lets users select multiple project files or a folder containing
project files. The main process resolves `.suwol-atlas.json` files, runs each
project with its stored options, and returns a project-level summary. Failed
projects are shown in the result panel while remaining projects continue.

Batch Sets are saved as `.suwol-atlas-batch.json` files. The Batch tab can:

- open a batch set
- save a batch set or save it as a new file
- add project files or folders into the batch set
- remove individual projects from the batch set
- replace the project list from a fresh selection
- run the current batch set immediately
- save `failFast` and manual schedule metadata

When saved, project paths are written relative to the batch set file when
possible. Schedule metadata is stored for future use, but no automatic
scheduled runner exists yet.

## Recent Items

Recent projects, input folders, and output folders are stored in Electron
`userData` with the regular GUI settings. Each list is deduplicated, newest
first, and capped at 10 entries. Missing paths are shown disabled and dimmed so
users can clean the list or clear it entirely.

Help > Clean Recent Items updates only the recent project/input/output lists in
GUI settings. Help > Clear Cache removes only `.suwol-atlas-cache.json` files
from known output folders.

## Preview

Preview pages are based on JSON `pages[]`.

- One page: `pages[0].image` is usually `{name}.png`.
- Multipack: `pages[0].image`, `pages[1].image`, and later entries are shown as
  selectable page tabs.
- Sprite selection uses each sprite's `page`, `x`, `y`, `w`, and `h` values to
  draw the preview rect.
- The pivot marker uses `pivotX` and `pivotY` from the selected sprite,
  including the current metadata editor values when available.
- Dragging the pivot marker updates `pivotX/pivotY` in project metadata and
  clamps values to `0..1`.
- Pivot preset buttons set center, bottom center, top left, top center, and
  bottom left.
- For rotated sprites, the marker is shown in atlas logical-rect coordinates.
  Original-orientation correction is left to engine/runtime interpretation.
- If a selected sprite belongs to another page, the GUI switches to that page.
- Fit mode uses percentage overlay coordinates; actual/custom zoom uses scaled
  pixel coordinates.

This keeps GUI preview aligned with CLI export naming.

## Settings

Settings are saved in Electron `userData` as:

```text
suwol-atlas-maker-settings.json
```

Saved values include input/output folders, atlas name, max size, padding,
algorithm, size mode, cache, watch, trim, extrude, rotate, clean, selected
profile, sprite metadata, last project path, recent project paths, recent input
folders, recent output folders, recommended-settings preference, preview zoom,
window size, language, and a `layout` object containing Project/Sprites/Status
open state, Project/Sprites widths, Status height, Advanced collapsed state,
and the active right-panel tab. Damaged or missing layout values are clamped or
restored to defaults. View menu reset commands can restore the workspace,
panel sizes, or filters without changing language. UI layout and recent-item
settings are not written to
`.suwol-atlas.json` project files or atlas export JSON.

Legacy settings are migrated on load:

- `bottomLogHeight` becomes `bottomStatusHeight`
- `logCollapsed: false` becomes `statusPanelOpen: true`
- `rightPanelTab: "sprites"` becomes `rightPanelTab: "list"`

## Localization

The top bar language selector supports System, English, and Korean. System maps
Korean OS/browser locales to Korean and all other locales to English. Changing
language updates renderer text immediately and sends IPC to the Electron main
process so the menu is rebuilt in the selected language.

Renderer localization uses `i18next` and `react-i18next` with resources under
`src/shared/i18n/locales`. Menu labels use the same key policy through shared
menu label helpers.

## Menu

The Electron main process creates the app menu:

- File > New Project
- File > Open Project
- File > Save
- File > Save As
- File > Open Output Folder
- Actions > Scan
- Actions > Export
- Actions > Batch Export
- View > Project Panel
- View > Sprites Panel
- View > Status
- View > Reset Workspace
- View > Reset Panel Sizes
- View > Reset Filters
- Help > Guide
- Help > Troubleshooting
- Help > Clear Cache
- Help > Clean Recent Items
- Help > About

Menu items send narrow commands to the renderer through the preload API.

## Current Limits

- no scheduled batch jobs
- no code signing or installer packaging
