# Signing Policy

Suwol Atlas Maker does not configure executable code signing in v0.1.5.
Linux release artifacts can include a GPG detached signature for
`checksums.txt`. Linux AppImage auto-update uses GitHub Releases update
metadata through `electron-updater`; the GPG checksum signature is a manual
download verification aid, not executable code signing.

## Current Policy

- No signing certificates are referenced in repository files.
- Linux checksum signing uses GitHub Secrets only:
  `GPG_PRIVATE_KEY_B64` and `GPG_PASSPHRASE`.
- The public key file may be committed as `suwol-release-public-key.asc`.
- Private keys, revocation certificates, and passphrases must never be
  committed.
- Release ZIP verification does not require signatures.
- Linux AppImage update trust policy is intentionally minimal in this MVP and
  should be strengthened in a later signing phase.
- Installer signing is deferred until installer packaging exists.

## Future Checklist

- Choose Windows Authenticode certificate storage.
- Decide whether signing runs locally, in CI, or both.
- Add signing only through environment variables or GitHub secrets.
- Verify signed executable metadata after packaging.
- Document certificate renewal and revocation handling.

Do not commit certificates, passwords, private keys, or machine-specific signing
configuration to this repository.
