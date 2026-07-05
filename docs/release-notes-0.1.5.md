# Suwol Atlas Maker 0.1.5 Release Notes

Suwol Atlas Maker 0.1.5 is a release-prep update focused on GUI editing flow,
i18n expansion readiness, batch set persistence, packaged ZIP verification, and
final editor UI polish.

## Highlights

- Sprite rows in the metadata table can be reordered by drag and drop.
- Sprite order also has Top, Up, Down, and Bottom fallback controls.
- Batch sets can be opened, saved, remembered, and run from the GUI Batch tab.
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

## Compatibility

- Atlas export JSON remains version `1`.
- Project files remain version `1`.
- Batch set files are version `1`.
- GUI layout settings are editor-only and are not written to project files or atlas export JSON.
- Unity and MonoGame runtime JSON compatibility is unchanged.

## Release Policy

This prep does not create a tag, push to GitHub, dispatch a workflow, or create
a GitHub Release. The expected follow-up release tag is `v0.1.5`.

## Baselines

- `v0.1.3`: known bad release candidate.
- `v0.1.4`: normal ZIP release baseline.
- `v0.1.5`: UI, i18n, batch set, layout hotfix, and release verification update.
