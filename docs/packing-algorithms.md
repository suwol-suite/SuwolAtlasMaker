# Packing Algorithms

Suwol Atlas Maker supports two packing algorithms:

- `shelf`
- `maxrects`

The CLI default is `shelf` for compatibility. GUI profiles can select a
different default, and users can change the algorithm manually.

## Shelf

The shelf packer places sprites left to right on a row, then opens a new row
when the current sprite no longer fits. If a page cannot fit the next sprite, it
opens another page.

This algorithm is predictable and easy to inspect. It is still useful for simple
sets, tests, and compatibility comparisons.

## MaxRects

The MaxRects packer tracks free rectangles on every page and places each sprite
with a best-short-side-fit score. After placement, it splits overlapping free
rectangles and prunes rectangles fully contained by another free rectangle.

MaxRects can reuse holes left by previous placements, so it usually produces
better occupancy for mixed sprite sizes than shelf packing. It also supports
multipack by creating a new page only when no existing page can fit the next
sprite.

## Shared Contracts

Both algorithms obey the same core contract:

- `padding` is transparent space between draw areas.
- `trim` changes content bounds before packing.
- `extrude` expands each sprite's draw area before packing.
- `rotate` allows 90-degree rotated placements when enabled.
- `max-size` limits each page width and height.
- pages are shrunk to the minimum used atlas area after placement.
- `sizeMode` is applied after placement and does not move sprite rects.
- atlas export JSON keeps the same `version: 1` schema.

The selected algorithm is written to the packing log and GUI project/settings
state. It is not written to atlas export JSON because loaders do not need to
know how a page was packed.

## Logs

Packing logs include:

- algorithm
- sprite count
- page count
- per-page width and height
- per-page used area, atlas area, and occupancy
- per-page raw and final size
- total used area, atlas area, and occupancy
- rotated sprite count
- trimmed sprite count
- multipack status
- metadata included/excluded counts, renamed count, pivot override count, and
  sidecar path when project sprite metadata is present
- ordered sprite count, trim mode override count, and manual crop count

## Samples

Use the packing comparison sample to generate the same source sprites with both
algorithms:

```bash
npm run sample:packing
```

Outputs:

- `samples/output-packing-shelf`
- `samples/output-packing-maxrects`
