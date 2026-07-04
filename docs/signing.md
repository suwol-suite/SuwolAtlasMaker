# Signing Plan

Suwol Atlas Maker does not configure code signing in v0.1.5.

## Current Policy

- No signing certificates are referenced in repository files.
- No signing secrets are expected in GitHub Actions.
- Release ZIP verification does not require signatures.
- Installer signing is deferred until installer packaging exists.

## Future Checklist

- Choose Windows Authenticode certificate storage.
- Decide whether signing runs locally, in CI, or both.
- Add signing only through environment variables or GitHub secrets.
- Verify signed executable metadata after packaging.
- Document certificate renewal and revocation handling.

Do not commit certificates, passwords, private keys, or machine-specific signing
configuration to this repository.

