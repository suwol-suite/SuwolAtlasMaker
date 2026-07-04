# ZIP Packaging

Suwol Atlas Maker uses `electron-builder` for unpacked Windows and Linux GUI
packaging, then `scripts/zip-release.mjs` to create GitHub Release ZIP assets.
Release ZIP assets are editor-only packages. Unity and MonoGame integrations
remain available from the repository source tree and are not included in the
ZIPs.

## Scripts

```bash
npm run icons:generate
npm run pack:win
npm run smoke:packaged:win
npm run zip:win
npm run verify:release:zip:win
npm run release:zip:win
npm run release:verify
npm run pack:linux
npm run smoke:packaged:linux
npm run zip:linux
npm run verify:release:zip:linux
npm run dist:win
```

- `icons:generate` creates SVG, PNG, and ICO assets from a local script.
- `pack:win` builds the GUI and creates an unpacked app in `release/win-unpacked`.
- `zip:win` writes `release/archives/SuwolAtlasMaker-${version}-win-x64.zip`.
- `verify:release:zip:win` verifies the Windows ZIP and `app.asar` contents.
- `release:zip:win` runs the Windows editor packaging, smoke, ZIP, and ZIP
  verification path.
- `release:verify` runs typecheck, i18n checks, tests, build, GUI build,
  Windows packaging, smoke, ZIP, and ZIP verification.
- `pack:linux` builds the GUI and creates an unpacked app in `release/linux-unpacked`.
- `zip:linux` writes `release/archives/SuwolAtlasMaker-${version}-linux-x64.zip`.
- `verify:release:zip:linux` verifies the Linux ZIP and `app.asar` contents.
- `dist:win` builds the GUI and creates a portable Windows artifact in `release`.
- `build:preload` bundles `src/electron/preload.ts` to
  `dist/electron/preload.cjs`.
- `copy:i18n-locales` copies locale JSON files to
  `dist/shared/i18n/locales` so packaged apps can load and verify them.

## Metadata

- `productName`: `Suwol Atlas Maker`
- `appId`: `work.godwish.suwol-atlas-maker`
- `artifactName`: `SuwolAtlasMaker-${version}-win-${arch}.${ext}`
- output directory: `release`
- Windows icon: `build/icon.ico`
- Linux icon: `build/icon.png`
- Linux target: `dir`
- Linux category: `Development`

## Included Files

The packaged app includes:

- `dist/electron/**/*`
- `dist/core/**/*`
- `dist/shared/**/*`
- `dist/renderer/**/*`
- `package.json`
- `LICENSE`

The packaged app explicitly excludes:

- `integrations/**`
- `samples/**`
- `tests/**`
- `docs/**`
- `scripts/**`
- `.github/**`
- `src/**`
- `release/**`

Icon resources are copied with `extraResources`:

- `build/icon.ico`
- `build/icon.png`

i18n locale files are copied into `dist/shared/i18n/locales` before packaging.
`scripts/verify-release-zip.mjs` verifies that English and Korean locale JSON
files are present in `app.asar` and can be parsed.

## Current Limits

The packaging MVP supports unpacked Windows/Linux folders and ZIP archives.
Installer targets, macOS builds, code signing, auto-update, AppImage, deb/rpm,
snap, winget, store distribution, and notarization are intentionally deferred.

See [`docs/signing.md`](signing.md) and [`docs/installer.md`](installer.md) for
planning notes. v0.1.5 does not add signing configuration, installer targets,
or release secrets.

GitHub Actions release details are documented in
[`docs/release.md`](release.md).
