# Known Issues

## v0.1.5

- Batch set scheduling is saved as metadata only. The app does not auto-run scheduled batches yet.
- Batch set paths are stored relative to the batch file when possible, but manually typed relative paths in an unsaved batch set resolve from the packaged app working directory.
- Drag reorder assigns explicit `order` metadata. Sorting the table by a non-order column can make the next order-sorted view look different from the current filtered view.
- Installer targets, code signing, auto-update, AppImage, deb/rpm, snap, winget, store distribution, and macOS packaging are not implemented.
- Renderer locale resources are bundled for English and Korean. Additional locale folders can be scaffolded but must be added to the registry and renderer resources before being enabled.

## Historical Notes

- `v0.1.3` is a known bad release candidate and should not be used for release comparisons.
- `v0.1.4` is the ZIP release baseline before the v0.1.5 UI and i18n prep work.

