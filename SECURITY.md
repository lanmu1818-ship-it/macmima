# Security Policy

## Supported Versions

Security fixes are currently prepared against the latest `main` branch.

## Reporting a Vulnerability

Please do not open a public issue for a suspected vulnerability.

Send a private report to the project maintainers with:

- A short description of the issue
- Reproduction steps
- Impact assessment
- Affected version or commit
- Any suggested fix

If you fork or self-host MacMima, rotate any affected secrets immediately when
a vulnerability involves deployment configuration, database access, object
storage keys, JWT secrets, or `AUTH_PEPPER`.

## Current Security Model

- Credential contents are encrypted client-side before upload.
- The server stores ciphertext, IV/nonce, auth tags, and metadata.
- User master passwords are not sent to the backend.
- Backend login verifiers are protected with Argon2id and `AUTH_PEPPER`.
- `AUTH_PEPPER` must be stored only in the server environment or secret
  manager. It must not be committed to Git or stored in the database.
- Local desktop API access requires a local API key and listens on
  `127.0.0.1`.

## Known Hardening Roadmap

- Replace workspace-key-derived shared vault encryption with per-user public
  key wrapping for shared vault keys.
- Add encrypted local backup export and recovery-key workflows.
- Add full Prisma migrations for repeatable deployments.
- Enable stronger Electron sandboxing and production code-signing hardening.
- Complete lint cleanup and add stricter CI gates.

## Deployment Notes

Use long random values for:

- `JWT_SECRET`
- `AUTH_PEPPER`
- Database passwords

Example:

```bash
openssl rand -base64 32
```
