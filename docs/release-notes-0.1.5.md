# Suwol Atlas Maker 0.1.5 Release Notes

Suwol Atlas Maker 0.1.5 is a release-prep update focused on GUI editing flow,
i18n expansion readiness, batch set persistence, packaged ZIP verification, and
final editor UI polish.

## Highlights

- Sprite rows in the metadata table can be reordered by drag and drop.
- Sprite order also has Top, Up, Down, and Bottom fallback controls.
- Batch sets can be opened, saved, edited, and run from the GUI Batch tab.
- Batch set files use `.suwol-atlas-batch.json`.
- i18n has a language registry and helper scripts for adding and checking locale folders.
- Packaged editor builds include locale JSON resources under `dist/shared/i18n/locales`.
- Release ZIP verification checks renderer relative asset URLs and packaged locale JSON files.
- The top bar displays the package app version (`v0.1.5`) instead of an Electron runtime version.
- Project, Sprites, and Status panels can be toggled, resized with splitters, and restored from GUI settings.
- The default workspace is Preview-first: Project is visible, Sprites is closed, and Status is collapsed.
- The initial preview and right Sprites panel now show compact, task-focused guidance before input/scan.
- The top bar now keeps only app name/version, panel toggles, and language selection.
- The app menu is organized as File, Actions, View, and Help without the previous diagnostics wording.
- Korean UI wording was tightened and long button labels were shortened to avoid wrapping.
- Quick Start adds PNG folder, output folder, sample project, and export entry points in the preview empty state.
- Export success now shows a result card with generated files, output folder, profile, algorithm, size mode, elapsed time, and actions for output folder, JSON, log, and export again.
- Recent projects, recent input folders, and recent output folders are easier to reopen and can be cleaned or cleared.
- Recommended settings can be applied manually or automatically when switching Generic, Unity, and MonoGame profiles.
- View menu reset commands restore workspace, panel sizes, or filters without resetting language.
- Batch Set UX now centers on a named project list with add/remove/save/open/manual-run controls and a disabled scheduled-run note.
- Common GUI errors are mapped to short user-friendly messages while technical details remain available in Status.
- Help > Guide adds in-app quick start, engine usage, troubleshooting, and file descriptions.
- Status now shows guided fixes for common errors.
- Export results now include validation feedback for generated JSON, page PNGs, sprite rects, metadata sidecar names, and loader-required fields.
- Help menu cleanup actions are limited to `.suwol-atlas-cache.json` files and recent-item settings.

## Compatibility

- Atlas export JSON remains version `1`.
- Project files remain version `1`.
- Batch set files are version `1`.
- GUI layout settings are editor-only and are not written to project files or atlas export JSON.
- Quick Start, recent items, recommended settings, and workspace reset preferences are editor-only and are not written to project files or atlas export JSON.
- Help, error guide, and export validation UI state are editor-only and are not written to atlas export JSON.
- Unity and MonoGame runtime JSON compatibility is unchanged.

## Release Policy

This prep does not create a tag, push to GitHub, dispatch a workflow, or create
a GitHub Release. The expected follow-up release tag is `v0.1.5`.

## Baselines

- `v0.1.3`: known bad release candidate.
- `v0.1.4`: normal ZIP release baseline.
- `v0.1.5`: UI, i18n, batch set, layout hotfix, and release verification update.
