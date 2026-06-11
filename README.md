# MacMima

MacMima is an open-source desktop vault for developer credentials, database
accounts, API keys, server access records, and team-shared configuration notes.

The app is designed around a simple principle: the server stores encrypted
records and synchronization metadata, while sensitive credential content is
encrypted on the client before it is sent to the backend.

## Features

- Personal vault and shared team vault
- End-to-end encrypted credential records
- Database credential fields with table-name and table-description notes
- Local desktop API for importing credentials from other tools
- Workspace key separation for self-hosted teams
- Admin controls for users, invite codes, and shared-vault access
- macOS and Windows Electron packaging

## Repository Layout

```text
.
├── electron/          # Electron main and preload processes
├── src/               # React desktop application
├── server/            # Express + Prisma backend
│   ├── prisma/        # Prisma schema
│   └── src/           # API source code
├── build/             # App icons and packaging assets
└── public/            # Static desktop app assets
```

The marketing website and release-management backend are intentionally not
included in this initial public source tree.

## Security Model

Credential bodies are encrypted in the desktop app with AES-GCM before they
are stored on the server. The user master password is not sent to the backend.

Authentication uses a client-side password hash for compatibility with the
desktop encryption flow. The backend stores that login verifier with Argon2id
and a server-side pepper (`AUTH_PEPPER`) so a leaked database cannot be used as
a direct login credential.

Shared-vault access is controlled by the backend and encrypted with a workspace
derived key in the current version. See [SECURITY.md](./SECURITY.md) for the
current guarantees and known hardening roadmap.

## Requirements

- Node.js 20+
- pnpm 9+
- MySQL 8+

## Desktop App Setup

```bash
pnpm install
pnpm dev
```

The desktop development UI runs through Vite. To run with Electron:

```bash
pnpm electron:dev
```

## Backend Setup

```bash
cd server
pnpm install
cp .env.example .env
```

Update `server/.env`:

```env
DATABASE_URL="mysql://user:password@localhost:3306/macmima"
JWT_SECRET="replace-with-a-long-random-secret"
AUTH_PEPPER="replace-with-a-different-long-random-secret"
ALLOWED_ORIGINS="http://localhost:5173"
```

Generate Prisma Client and initialize the database:

```bash
npx prisma generate
npx prisma db push
pnpm build
pnpm start
```

For production, prefer proper Prisma migrations over `db push`.

## Packaging

```bash
pnpm electron:build
pnpm electron:build:win
```

Generated installers are written to `release/` and are ignored by Git.

## Open-Source Status

This source tree is being prepared for public release. The current quality gate
is:

```bash
pnpm exec tsc --noEmit
cd server && pnpm build && pnpm audit --prod
```

ESLint cleanup is still in progress and should be completed before accepting
external pull requests.

## License

MIT
