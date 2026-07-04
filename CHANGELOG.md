# Changelog

## 0.1.5

- Prepared the v0.1.5 release version in `package.json` and `package-lock.json`.
- Added sprite row drag reorder in the GUI metadata table, with Top/Up/Down/Bottom fallback controls and undo/redo support through existing project history.
- Added GUI Batch Set MVP for opening, remembering, saving, and running `.suwol-atlas-batch.json` files.
- Added i18n registry and locale scaffolding scripts so future locale folders can exist before they are enabled.
- Copied locale JSON files into packaged runtime output and strengthened release ZIP verification for packaged locale resources.
- Added release prep documentation, manual QA notes, known issues, signing notes, and installer planning notes.

## 0.1.4

- Established the working ZIP release baseline for packaged editor apps.
- Kept GitHub Release ZIP assets editor-only while CI continued checking Unity and MonoGame integrations.

## 0.1.3

- Known bad release candidate. Windows release packaging failed around optional MonoGame Content Pipeline references and should not be used as a baseline.

