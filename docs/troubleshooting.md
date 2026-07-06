# Troubleshooting

The editor shows short user-facing errors in Status and keeps technical details
inside the expanded Status text.

Common guided fixes:

- Choose a PNG folder when no input folder is selected.
- Add `.png` files or choose another folder when the input folder is empty.
- Rename files or set sprite name overrides when sprite names are duplicated.
- Increase Max Size or reduce the source image when an image is too large.
- Move manual crop rectangles inside the source image.
- Check that the output folder still exists and is accessible.
- If update checks fail, confirm the app is the packaged Linux AppImage build
  and that the GitHub Release includes `latest-linux.yml` and the AppImage
  blockmap.

Maintenance actions:

- Help > Clear Cache removes only `.suwol-atlas-cache.json` files from known
  output folders.
- Help > Clean Recent Items updates only recent project/input/output lists in
  saved GUI settings.

These actions do not delete project files or exported atlas files.

Linux updates:

- Automatic updates are supported only for packaged Linux AppImage builds.
- Development builds, Windows, macOS, ZIP, tar.gz, deb, rpm, and pacman builds
  show an unsupported update state.
- Downloads and restart/install are user-triggered. Failed update checks do not
  block atlas work.
