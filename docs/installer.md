# Installer And Update Plan

Suwol Atlas Maker v0.1.5 keeps installer work deferred. Linux AppImage
auto-update is available as a separate MVP for packaged AppImage builds.

## Current Distribution

- Windows unpacked app: `release/win-unpacked`
- Windows ZIP: `release/archives/SuwolAtlasMaker-${version}-win-x64.zip`
- Linux unpacked app: `release/linux-unpacked`
- Linux ZIP: `release/archives/SuwolAtlasMaker-${version}-linux-x64.zip`
- Linux AppImage: `release/SuwolAtlasMaker-${version}-linux-x64.AppImage`
- Linux tar.gz: `release/SuwolAtlasMaker-${version}-linux-x64.tar.gz`
- Linux update metadata: `release/latest-linux.yml` and AppImage blockmap

## Deferred Installer Work

- Windows installer
- macOS app and notarization
- Linux deb/rpm
- snap
- winget
- store distribution
- Windows/macOS auto-update
- ZIP, tar.gz, deb, rpm, and pacman auto-update

Installer work should come after signing policy, upgrade behavior, install
location, file association, and uninstall cleanup are specified.
