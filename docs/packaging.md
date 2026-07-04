# ZIP Packaging

Suwol Atlas Maker uses `electron-builder` for unpacked Windows and Linux GUI
packaging, then `scripts/zip-release.mjs` to create GitHub Release ZIP assets.

## Scripts

```bash
npm run icons:generate
npm run pack:win
npm run zip:win
npm run pack:linux
npm run zip:linux
npm run dist:win
```

- `icons:generate` creates SVG, PNG, and ICO assets from a local script.
- `pack:win` builds the GUI and creates an unpacked app in `release/win-unpacked`.
- `zip:win` writes `release/archives/SuwolAtlasMaker-${version}-win-x64.zip`.
- `pack:linux` builds the GUI and creates an unpacked app in `release/linux-unpacked`.
- `zip:linux` writes `release/archives/SuwolAtlasMaker-${version}-linux-x64.zip`.
- `dist:win` builds the GUI and creates a portable Windows artifact in `release`.
- `build:preload` bundles `src/electron/preload.ts` to
  `dist/electron/preload.cjs`.

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

Icon resources are copied with `extraResources`:

- `build/icon.ico`
- `build/icon.png`

## Current Limits

The packaging MVP supports unpacked Windows/Linux folders and ZIP archives.
Installer targets, macOS builds, code signing, auto-update, AppImage, deb/rpm,
snap, winget, store distribution, and notarization are intentionally deferred.

GitHub Actions release details are documented in
[`docs/release.md`](release.md).
