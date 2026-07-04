# Project Files And Profiles

Suwol Atlas Maker project files store GUI workflow state. They are not atlas
export JSON files.

## Extension

```text
.suwol-atlas.json
```

## Schema

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

The project file `version` starts at `1`, but it is separate from atlas export
JSON `version: 1`.

## Sprite Metadata

`sprites` is a map keyed by PNG path relative to `inputDir`. Keys are normalized
to use `/`, even on Windows:

- `hero_idle_0.png`
- `characters/hero/idle_0.png`

Supported fields:

- `include`: `false` excludes the source PNG from export. Default: `true`.
- `nameOverride`: optional final sprite name in atlas JSON, without extension.
- `pivotX` / `pivotY`: normalized pivot values from `0` to `1`. Default:
  `0.5`.
- `tags`: optional string array for sidecar metadata.
- `group`: optional string for sidecar metadata.
- `order`: optional non-negative integer. Lower values are packed/exported
  first. Missing values keep the existing stable packer ordering.
- `trimMode`: `default`, `auto`, `none`, or `manual`. Default: `default`.
- `crop`: source PNG rectangle used when `trimMode` is `manual`.

Trim modes:

- `default`: use the global trim option.
- `auto`: alpha-trim this sprite regardless of the global trim option.
- `none`: keep this sprite's full source PNG.
- `manual`: use `crop` in source PNG coordinates.

Validation rules:

- `include` must be boolean when present.
- `nameOverride` is trimmed, must not be empty, and cannot contain
  `/`, `\`, `:`, `*`, `?`, `"`, `<`, `>`, or `|`.
- `pivotX` and `pivotY` must be finite numbers from `0` to `1`.
- `tags` must be a string array. Empty tags are removed, duplicates are
  removed case-insensitively, and each tag is limited to 64 characters.
- `group` is trimmed and limited to 64 characters.
- `order` must be a finite non-negative integer.
- `trimMode` must be one of `default`, `auto`, `none`, or `manual`.
- `crop.x`, `crop.y`, `crop.w`, and `crop.h` must be integers.
- `crop.x >= 0`, `crop.y >= 0`, `crop.w > 0`, and `crop.h > 0`.
- manual crop bounds must stay inside the source PNG dimensions.
- `trimMode: manual` requires `crop`; crop on non-manual modes is ignored for
  atlas export.
- final sprite names after `nameOverride` must be unique among included
  sprites.

Atlas export JSON still keeps the existing `version: 1`, `pages[]`, and
`sprites[]` shape. Include/name/pivot/order/trimMode/crop affect packing or
the existing atlas rect fields, but `tags`, `group`, `order`, `trimMode`,
`crop`, `sourcePath`, and other editor metadata are not written directly into
atlas JSON. They are written to `{name}.metadata.json` when sidecar export is
enabled.

## Profiles

Profiles apply recommended GUI options:

- `generic`: general-purpose defaults with `algorithm=shelf`,
  `sizeMode=tight`, `cache=false`, and `watch=false`.
- `unity`: trim, extrude, rotate, `algorithm=maxrects`, `sizeMode=pot`, and
  `cache=true`.
- `monogame`: trim, extrude, `algorithm=maxrects`, `sizeMode=pot`, and
  `cache=true`, with rotate disabled by default.

Profiles do not change atlas export fields. Unity and MonoGame loaders continue
to read the same `{name}.json` output.

## Migration

Older project files without `options.algorithm` are normalized to
`algorithm=shelf`, matching the CLI default. Older project files without
`options.sizeMode`, `options.cache`, or `options.watch` are normalized to
`tight`, `false`, and `false`. Invalid algorithm and size mode values are
replaced with safe defaults during normalization. Older project files without
`sprites`, `order`, `trimMode`, or `crop` continue to load; missing sprite
metadata fields use their defaults.

## Dirty State

The renderer stores export options and sprite metadata in an undo/redo history.
The dirty state compares the current history snapshot against the most recent
loaded or saved baseline. Changing options or sprite metadata marks the project
dirty. Saving updates the baseline and clears the dirty state. Undoing back to
the saved snapshot also clears dirty state.

## Metadata Cleanup

The GUI scan can show metadata entries whose source PNG no longer exists under
`inputDir`. These entries are marked as missing and can be removed with the
cleanup action. Cleanup is an undoable metadata edit. CLI project export does
not delete missing metadata automatically; missing metadata remains a project
maintenance concern.

Source preview and crop IPC calls accept only paths resolved from `inputDir`
plus a normalized relative PNG path. Absolute paths, `..` traversal, and
non-PNG preview requests are rejected in the Electron main process.

## Recent Projects

Recent project paths are stored in Electron `userData` settings, newest first,
deduplicated, and capped at 10 entries. Missing paths are pruned when the list
is loaded.
