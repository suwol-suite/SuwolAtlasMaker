# Linux AppImage Auto-Update

Suwol Atlas Maker supports a Linux-only auto-update MVP for packaged AppImage
builds.

## Scope

Supported:

- Linux
- packaged Electron app
- AppImage
- GitHub Releases provider
- stable channel

Not supported:

- Windows auto-update
- macOS auto-update
- ZIP, tar.gz, deb, rpm, or pacman auto-update
- development mode update checks
- silent background install
- forced updates
- custom update servers

## Runtime Gate

The updater is active only when all conditions pass:

- `process.platform === "linux"`
- `app.isPackaged === true`
- `process.env.APPIMAGE` is present
- `settings.updates.linuxEnabled === true`

Otherwise the UI reports an unsupported state with a reason.

## User Flow

The app may check for updates on startup when `linuxAutoCheck` is enabled and
the runtime gate is supported. Download starts only after the user chooses
Download. Restart/install starts only after the user chooses Restart to Update.

Failures are shown in Status and do not block normal atlas work.

## Release Files

GitHub Releases must include:

- `SuwolAtlasMaker-<version>-linux-x64.AppImage`
- `SuwolAtlasMaker-<version>-linux-x64.AppImage.blockmap`
- `latest-linux.yml`

The Linux release workflow may also upload:

- `SuwolAtlasMaker-<version>-linux-x64.tar.gz`
- `checksums.txt`
- `checksums.txt.asc`
- `suwol-release-public-key.asc`

## Signing Secrets

The Linux release workflow reads signing material only from GitHub Secrets:

- `GPG_PRIVATE_KEY_B64`
- `GPG_PASSPHRASE`

Do not commit the private key, passphrase, or revocation certificate. The public
key may be committed as `suwol-release-public-key.asc`.

## Manual Verification

Checksum and GPG verification are for users who manually download release
files. They are separate from the `electron-updater` AppImage update flow.

```bash
gpg --import suwol-release-public-key.asc
gpg --verify checksums.txt.asc checksums.txt
sha256sum -c checksums.txt
```

On macOS, use:

```bash
shasum -a 256 -c checksums.txt
```
