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
- Confirm the top bar contains compact Project, Sprites, and Status toggles plus the language selector.
- Switch language between System, English, and Korean.
- Confirm Korean labels use `아틀라스`, `스프라이트`, `미리보기`, `내보내기`, and `상태`.
- With no input/output folders selected, confirm the preview says `Create an atlas` / `아틀라스를 만들어 보세요` and shows PNG folder, output folder, and export actions without duplicated numbering.
- Confirm the default layout opens Project visible, Sprites hidden, and Status collapsed.
- Toggle Project, Sprites, and Status with Ctrl+1, Ctrl+2, and Ctrl+3.
- Drag the Project, Sprites, and Status splitters; close and reopen the app and confirm the layout is restored.
- Double-click each splitter and confirm it returns to the default size.
- Confirm buttons and tabs do not wrap on narrow panel widths.
- Confirm the document body itself does not scroll; only panels, tables, and expanded Status details scroll.
- Open or create a project.
- Scan an input folder.
- Confirm the List tab hides batch/edit buttons before input or scan, and the Selected tab shows only guidance when no sprite is selected.
- Reorder sprite rows by drag and drop.
- Reorder the same rows with Top, Up, Down, and Bottom controls.
- Use Undo and Redo after reorder.
- Export and confirm sprite JSON order follows the saved sprite order.
- Trigger a validation error and confirm the bottom Status line shows the message with a Details button.

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
