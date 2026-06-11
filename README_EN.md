<p align="center">
  <img src="./build/icon.png" alt="MacMima Logo" width="96" height="96" />
</p>

<h1 align="center">MacMima</h1>

<p align="center">
  A secure, self-hostable vault for new AI developers to organize accounts, passwords,
  API keys, server keys, database credentials, and team configuration notes.
</p>

<p align="center">
  <a href="./README.md">简体中文</a>
  ·
  <a href="./README_EN.md">English</a>
  ·
  <a href="https://macmima.flnxi.com">Website Demo</a>
  ·
  <a href="./docs/en/APP_USAGE.md">App Guide</a>
  ·
  <a href="./docs/en/BACKEND_DEPLOYMENT.md">Backend Deployment</a>
  ·
  <a href="./docs/en/TECHNICAL_OVERVIEW.md">Technical Overview</a>
</p>

## What MacMima Is

AI developers quickly accumulate highly sensitive material: model provider API keys,
cloud server SSH keys, database passwords, admin accounts, webhook secrets, shared
environment notes, and database table documentation.

MacMima is an open-source desktop credential vault designed to bring those developer
secrets into one encrypted, self-hostable, team-friendly workspace.

## Core Features

- Personal Vault: store credentials that only the current user can decrypt.
- Shared Vault: admins can grant shared-vault access to selected team members.
- Database Notes: store database credentials together with table names and table descriptions.
- Local API: allow trusted local tools to push credentials into the unlocked desktop app.
- Workspace Key: isolate multiple teams or workspaces on one backend.
- Admin Controls: manage users, invite codes, and shared-vault permissions.
- Self-Hosted Backend: Express + Prisma + MySQL.
- Desktop Packaging: Electron builds for macOS and Windows.

## Security Model: No Plaintext Credentials On The Backend

MacMima's core security principle is simple: the backend handles sync, permissions,
and metadata; sensitive credential bodies are encrypted in the desktop app before upload.

The backend database does not store plaintext passwords, plaintext API keys, or plaintext SSH private keys.

| Data | Stored plaintext in backend database? |
| --- | --- |
| Website passwords, database passwords, API keys, SSH private keys, connection strings, table notes | No. Encrypted locally with AES-GCM before upload |
| User master password | No. It is never sent to the backend |
| Login verifier | Not a plaintext password. The backend stores an Argon2id verifier with `AUTH_PEPPER` |
| Credential title, category, tags, timestamps | Yes. These are metadata used for listing and search. Do not put secrets in titles or tags |
| Ciphertext, IV, auth tag | Yes. These encrypted values are stored for sync |

The Personal Vault uses a key derived from the user's master password. The Shared Vault
currently uses a key derived from the workspace key. See [Security Model](./docs/en/SECURITY.md)
for threat boundaries, breach scenarios, and the hardening roadmap.

## Quick Start

Requirements:

- Node.js 20+
- pnpm 9+
- MySQL 8+

Start the desktop web UI:

```bash
pnpm install
pnpm dev
```

Start with Electron:

```bash
pnpm electron:dev
```

Start the backend:

```bash
cd server
pnpm install
cp .env.example .env
npx prisma generate
npx prisma db push
pnpm build
pnpm start
```

For production backend setup, read [Backend Deployment](./docs/en/BACKEND_DEPLOYMENT.md).

## Documentation

- [Product Introduction](./docs/en/INTRODUCTION.md)
- [App Usage Guide](./docs/en/APP_USAGE.md)
- [Backend Deployment](./docs/en/BACKEND_DEPLOYMENT.md)
- [Technical Overview](./docs/en/TECHNICAL_OVERVIEW.md)
- [Local API](./docs/en/LOCAL_API.md)
- [Security Model](./docs/en/SECURITY.md)
- [Contributing](./CONTRIBUTING.md)

## Repository Layout

```text
.
├── electron/          # Electron main/preload and Local API
├── src/               # React desktop app
├── server/            # Express + Prisma backend
│   ├── prisma/        # Prisma schema
│   └── src/           # API source
├── build/             # App icon and packaging assets
├── public/            # Static assets
└── docs/              # Documentation
```

The marketing website source and release-management backend are not included in this
initial public source tree. Whether to open-source them will be decided separately.

## Packaging

```bash
pnpm electron:build
pnpm electron:build:win
```

Installers are written to `release/`, which is ignored by Git.

## Current Open-Source Status

Current quality gate:

```bash
pnpm exec tsc --noEmit
cd server && pnpm build && pnpm audit --prod
```

ESLint cleanup is still in progress. Lint and tests should be tightened before
accepting broad external contributions.

## License

MIT
