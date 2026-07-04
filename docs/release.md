# GitHub Release ZIP Automation

Suwol Atlas Maker publishes ZIP-only desktop builds through GitHub Actions.
Installer targets, code signing, auto-update, AppImage, deb/rpm, snap, winget,
store distribution, and macOS builds are intentionally out of scope for this
release MVP.

## Artifacts

For `package.json` version `0.1.0`, the release workflow uploads:

- `SuwolAtlasMaker-0.1.0-win-x64.zip`
- `SuwolAtlasMaker-0.1.0-linux-x64.zip`

The ZIP files are written locally under:

```text
release/archives/
```

Each ZIP contains the contents of the corresponding unpacked Electron output
folder, including the executable and `resources/app.asar`.

## Local Commands

Windows:

```bash
npm.cmd install
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run build:gui
npm.cmd run build:unity-check
npm.cmd run build:monogame
npm.cmd run build:monogame:pipeline
npm.cmd run pack:win
npm.cmd run zip:win
npm.cmd run check:release-version
```

Linux:

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run build:gui
npm run build:unity-check
npm run pack:linux
npm run zip:linux
```

Node.js 22 LTS is recommended and is used by the GitHub Actions workflows.

## Workflows

CI:

```text
.github/workflows/ci.yml
```

Runs on pull requests and pushes to `main`. Windows runs the full validation
suite including Unity and MonoGame integration checks. Linux validates the
Node/Electron build path.

Release:

```text
.github/workflows/release.yml
```

Runs on:

- tag pushes matching `v*`
- manual workflow dispatch

The release workflow has three jobs:

- `build-windows`: validates, packages `release/win-unpacked`, creates the
  Windows ZIP, and uploads it as an artifact.
- `build-linux`: validates, packages `release/linux-unpacked`, creates the
  Linux ZIP, and uploads it as an artifact.
- `release`: downloads both ZIP artifacts and uploads them to a GitHub Release.

The release workflow uses the default `GITHUB_TOKEN` with `contents: write`.
No personal tokens or npm tokens are required.

## Tag Policy

Release tags should match the package version:

```bash
git tag v0.1.0
git push origin v0.1.0
```

`npm run check:release-version` compares tag refs against
`package.json.version`. For tag releases, `refs/tags/v${version}` is required.
For manual workflow dispatch, the optional `tag` input is also checked when it
is provided. If no tag context is available locally, the script prints a warning
and exits successfully.

## Release Notes

The release workflow uses GitHub generated release notes through
`softprops/action-gh-release`.

## Troubleshooting

- Electron allow-scripts warning: `npm install` may warn about
  `electron-winstaller` and `esbuild` install scripts. The current build path
  still succeeds with npm's pending allow-scripts warning.
- Linux headless smoke: the Linux smoke script checks the unpacked folder,
  executable bit, `resources`, `app.asar`, and icon resources. It does not
  launch the GUI in CI.
- MonoGame build lock: run `build:monogame` and `build:monogame:pipeline`
  sequentially. Parallel builds can contend for the same runtime DLL.
- Missing `dist/core` or `dist/shared`: run `npm run build` and
  `npm run build:gui` before packaging.
- Preload CJS issue: `build:preload` bundles `src/electron/preload.ts` to
  `dist/electron/preload.cjs`, which is the file loaded by Electron.
