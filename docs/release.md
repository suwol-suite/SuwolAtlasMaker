# GitHub Release ZIP Automation

Suwol Atlas Maker publishes editor-only ZIP assets through GitHub Actions.
The release ZIPs contain the packaged Electron editor app only. Unity and
MonoGame integrations remain in the repository source tree and are validated by
CI, but they are not bundled into GitHub Release ZIP assets.

Installer targets, code signing, auto-update, AppImage, deb/rpm, snap, winget,
store distribution, and macOS builds are intentionally out of scope for this
release MVP.

## Artifacts

For `package.json` version `0.1.3`, the release workflow uploads only:

- `SuwolAtlasMaker-0.1.3-win-x64.zip`
- `SuwolAtlasMaker-0.1.3-linux-x64.zip`

The ZIP files are written locally under:

```text
release/archives/
```

Each ZIP contains the contents of the corresponding unpacked Electron output
folder, including the executable, Electron runtime files, Chromium/Node support
files, `resources/app.asar`, preload bundle, renderer build, `dist/core`, and
`dist/shared`.

Release ZIPs must not contain:

- `integrations/unity`
- `integrations/monogame`
- `samples`
- `tests`
- `scripts`
- `docs`
- `src`
- `.github`
- development build outputs or nested `release/archives`

## Local Commands

Windows editor release path:

```bash
npm.cmd install
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run build:gui
npm.cmd run pack:win
npm.cmd run smoke:packaged:win
npm.cmd run zip:win
npm.cmd run verify:release:zip:win
```

Linux editor release path:

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run build:gui
npm run pack:linux
npm run smoke:packaged:linux
npm run zip:linux
npm run verify:release:zip:linux
```

Full repository validation remains separate:

```bash
npm run build:unity-check
npm run build:monogame
npm run build:monogame:pipeline
npm run sample
npm run sample:advanced
npm run sample:multipack
npm run sample:packing
npm run sample:pot
npm run sample:metadata
npm run sample:editing
npm run sample:ux
npm run sample:batch
```

Node.js 22 LTS is recommended and is used by the GitHub Actions workflows.

## Workflow Split

CI:

```text
.github/workflows/ci.yml
```

Runs on pull requests and pushes to `main`. CI is the full repository sanity
workflow. It keeps Unity checks, MonoGame runtime checks, MonoGame Content
Pipeline checks, and sample exports.

Release:

```text
.github/workflows/release.yml
```

Runs on:

- tag pushes matching `v*`
- manual workflow dispatch

The release workflow builds and uploads editor-only ZIP assets:

- `build-windows`: typechecks, tests, builds the editor, packages
  `release/win-unpacked`, smoke-checks it, creates the Windows ZIP, and uploads
  it as an artifact.
- `build-linux`: typechecks, tests, builds the editor, packages
  `release/linux-unpacked`, smoke-checks it, creates the Linux ZIP, and uploads
  it as an artifact.
- `release`: downloads both ZIP artifacts and uploads them to a GitHub Release.

The release workflow intentionally does not run:

- `npm run build:unity-check`
- `npm run build:monogame`
- `npm run build:monogame:pipeline`
- `npm run sample:*`

This keeps editor ZIP publication from being blocked by optional engine
integration build details. Those integrations are still checked by CI.

## ZIP Verification

`scripts/verify-release-zip.mjs` checks:

- Windows or Linux executable presence
- `resources`
- `resources/app.asar`
- packaged icon resources
- required `app.asar` runtime entries, including preload, renderer,
  `dist/core`, and `dist/shared`
- forbidden top-level directories in the unpacked app
- forbidden top-level directories in `app.asar`
- forbidden top-level directories in the ZIP archive
- non-empty ZIP archive size

`scripts/zip-release.mjs` validates the unpacked app before creating a ZIP and
validates the ZIP after writing it.

## Engine Integrations

Unity integration is provided as source under:

```text
integrations/unity
```

Use it as a Unity Package Manager local or git package.

MonoGame integration is provided as source under:

```text
integrations/monogame
```

Build or reference it from your MonoGame project as needed. The MonoGame
Content Pipeline project remains available for CI and local development, but it
is not a release artifact.

## Tag Policy

Release tags should match the package version:

```bash
npm version patch -m "Release v%s"
git push origin main --follow-tags
```

For this release, the expected tag is:

```text
v0.1.3
```

`npm run check:release-version` remains available for local or future workflow
checks and compares tag refs against `package.json.version`.

## Release Notes

The release workflow uses GitHub generated release notes through
`softprops/action-gh-release`.

## Troubleshooting

- Electron allow-scripts warning: `npm install` may warn about
  `electron-winstaller` and `esbuild` install scripts. The current build path
  still succeeds with npm's pending allow-scripts warning.
- Linux headless smoke: the Linux smoke script checks the unpacked folder,
  executable bit, `resources`, `app.asar`, icon resources, and forbidden
  package contents. It does not launch the GUI in CI.
- Missing `dist/core` or `dist/shared`: run `npm run build` and
  `npm run build:gui` before packaging.
- Preload CJS issue: `build:preload` bundles `src/electron/preload.ts` to
  `dist/electron/preload.cjs`, which is the file loaded by Electron.
