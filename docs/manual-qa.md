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
- Confirm the top bar shows `v0.1.5`, not the Electron runtime version.
- Switch language between System, English, and Korean.
- Confirm Korean labels use `아틀라스`, `스프라이트`, `미리보기`, `내보내기`, and `로그 접기`.
- With no input/output folders selected, confirm the preview explains the three-step input/output/scan-or-export flow.
- Drag the Project, Sprites, and Log splitters; close and reopen the app and confirm the layout is restored.
- Double-click each splitter and confirm it returns to the default size.
- Confirm buttons do not wrap on narrow panel widths.
- Open or create a project.
- Scan an input folder.
- Confirm the Sprites tab hides bulk/edit buttons before input or scan, and the Selected tab shows only guidance when no sprite is selected.
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
