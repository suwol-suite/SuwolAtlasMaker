# Known Issues

## v0.1.5

- Batch set scheduling is saved as metadata only. The app does not auto-run scheduled batches yet.
- Batch set paths are stored relative to the batch file when possible, but manually typed relative paths in an unsaved batch set resolve from the packaged app working directory.
- Packaged editor ZIPs intentionally exclude `samples`; Open Sample Project shows a friendly fallback message in packaged builds.
- Drag reorder assigns explicit `order` metadata. Sorting the table by a non-order column can make the next order-sorted view look different from the current filtered view.
- Installer targets, executable code signing, Windows/macOS auto-update, deb/rpm, snap, winget, store distribution, and macOS packaging are not implemented.
- Linux automatic updates are limited to packaged AppImage builds. ZIP, tar.gz, deb, rpm, pacman, and development builds report unsupported.
- Renderer locale resources are bundled for English and Korean. Additional locale folders can be scaffolded but must be added to the registry and renderer resources before being enabled.
- Export validation is intentionally advisory in the GUI. It reports generated-file issues in Status but does not add validation data to atlas JSON.

## Resolved In v0.1.5 Prep

- The editor top bar now reads the package app version instead of the Electron runtime version.
- The v0.1.5 editor layout has toggleable Project, Sprites, and Status panes with saved settings.
- The initial empty state and right Sprites panel were simplified to reduce first-run clutter.
- Quick Start, export result card, recent project/folder lists, recommended settings, and workspace reset commands improve the first-run and post-export flow.
- Open Output Folder now has explicit result-card QA coverage and friendly missing-folder feedback.
- In-app Help, guided error fixes, export validation feedback, and safe cache/recent cleanup commands reduce recovery friction without changing export JSON.

## Historical Notes

- `v0.1.3` is a known bad release candidate and should not be used for release comparisons.
- `v0.1.4` is the ZIP release baseline before the v0.1.5 UI and i18n prep work.
