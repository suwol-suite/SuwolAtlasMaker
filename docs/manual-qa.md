# Manual QA

Use this checklist before creating a release tag.

## Core

- Run `npm.cmd install`.
- Run `npm.cmd run release:verify`.
- Run `npm.cmd run sample`.
- Run `npm.cmd run sample:metadata`.
- Run `npm.cmd run sample:editing`.
- Run `npm.cmd run sample:ux`.
- Confirm atlas PNG and JSON outputs are created under `samples/output*`.

## GUI

- Launch the unpacked Windows app from `release/win-unpacked`.
- Confirm the first window shows the full UI, not a blank white page.
- Switch language between System, English, and Korean.
- Open or create a project.
- Scan an input folder.
- Reorder sprite metadata rows by drag and drop.
- Reorder the same rows with Top, Up, Down, and Bottom controls.
- Use Undo and Redo after reorder.
- Export and confirm sprite JSON order follows the metadata order.

## Batch Sets

- Select multiple `.suwol-atlas.json` projects.
- Save a `.suwol-atlas-batch.json` file.
- Close and reopen the batch set.
- Confirm project paths are preserved.
- Run Batch Now.
- Confirm failed projects are reported without corrupting successful results.

## Packaging

- Confirm `dist/renderer/index.html` uses relative `./assets/...` URLs.
- Confirm `release/archives/SuwolAtlasMaker-0.1.5-win-x64.zip` exists after `npm.cmd run zip:win`.
- Confirm `npm.cmd run verify:release:zip:win` passes.
- Confirm packaged `app.asar` contains `dist/shared/i18n/locales/en` and `dist/shared/i18n/locales/ko`.

