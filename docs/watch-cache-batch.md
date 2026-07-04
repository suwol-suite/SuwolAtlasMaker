# Watch, Cache, Batch, And Size Modes

## Watch

CLI:

```bash
suwol-atlas make ./samples/input ./samples/output --name sample_atlas --watch
suwol-atlas make --project ./samples/projects/metadata-demo.suwol-atlas.json --watch
```

GUI:

- enable the Watch toggle
- keep manual Export available
- watch status shows the latest trigger and auto-export result

Watch behavior:

- only input PNG changes are watched
- rapid changes are debounced
- one follow-up export is queued when changes arrive during an export
- export errors are shown but do not stop watch mode
- output folders inside input folders are refused to avoid loops
- when `--project` is used, the project file is reloaded before each export so
  saved sprite metadata changes are applied

## Cache

Enable cache with:

```bash
suwol-atlas make ./samples/input ./samples/output --name sample_atlas --cache
```

The cache file is:

```text
.suwol-atlas-cache.json
```

It is written under the output folder and records:

- tool version
- input folder
- option hash
- relative PNG path
- size and `mtimeMs`
- SHA-256 hash
- decoded width and height

Cache hits, misses, and invalidation reasons are written to the packing log.
Current exports still rebuild from current source files, so stale or damaged
cache files cannot corrupt PNG or JSON output.

## Batch Export

CLI:

```bash
suwol-atlas batch ./samples/projects
suwol-atlas batch ./atlas-a.suwol-atlas.json ./atlas-b.suwol-atlas.json
```

Batch behavior:

- directories are scanned recursively for `.suwol-atlas.json`
- relative project paths are resolved from the project file directory
- each project's `sprites` metadata map is applied during export
- failures are reported per project
- remaining projects continue by default
- `--fail-fast` stops after the first failure

GUI batch export uses the same core batch path through Electron IPC.

## Size Modes

CLI:

```bash
suwol-atlas make ./samples/input ./samples/output --size-mode pot
```

Modes:

- `tight`: final page size equals raw used page size
- `pot`: width and height are rounded independently to power-of-two
- `square-pot`: the larger side is rounded to power-of-two and used for both
  dimensions

Size mode is applied after packing. Sprite coordinates stay unchanged, and JSON
`pages[].width/height` matches the actual PNG dimensions.
