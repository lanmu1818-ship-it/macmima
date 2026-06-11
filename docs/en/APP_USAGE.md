# App Usage Guide

This guide explains the daily MacMima desktop app workflow.

## 1. First Launch

On first launch, configure:

- Backend URL
- Workspace Key

Backend URL example:

```text
https://your-domain.example/api
```

The Workspace Key separates teams and workspaces on the same backend. Use a long random
value and share it only with members of the same team.

If this backend and workspace key are new, the first registered user becomes the admin.
If the backend is already initialized, regular users need an invite code from an admin.

## 2. Register And Log In

Registration fields:

- Username
- Email
- Master password
- Invite code, not required for the first admin

The master password is critical. It is not just a login password; it is also the source of
the Personal Vault encryption key. If it is forgotten, the backend cannot recover encrypted
Personal Vault data.

After login, the app derives the local decryption key and syncs ciphertext from the backend.

## 3. What Is Actually Saved To The Backend

MacMima syncs data to the backend database, but it does not sync plaintext credential bodies.

When you save a website password, database password, API key, SSH private key, or connection
string, the desktop app first:

1. Derives an encryption key from the master password or workspace key.
2. Encrypts the credential body with AES-GCM.
3. Uploads only ciphertext, IV, authentication tag, and necessary metadata.

The backend database can see:

- Credential title
- Category
- Tags
- Owner and Personal/Shared scope
- Created and updated timestamps
- `encryptedData`, `iv`, `authTag`

The backend database should not see:

- Plaintext website passwords
- Plaintext database passwords
- Plaintext API keys
- Plaintext SSH private keys
- Plaintext connection strings
- Plaintext table relationship details

Put real secrets inside the credential body, not in titles or tags.

## 4. Personal Vault

Use the Personal Vault for:

- Personal model provider API keys
- Personal SSH/server access
- Personal database accounts
- Test admin accounts
- Private development configuration

Personal Vault bodies are encrypted with a key derived from the master password. The backend
stores only ciphertext, IV, authentication tag, and metadata.

## 5. Shared Vault

Use the Shared Vault for:

- Team development environment configuration
- Shared database accounts
- Shared test accounts
- Team API keys
- Project handoff notes

Admins can grant or revoke Shared Vault access in user management.

The current Shared Vault derives its key from the workspace key. The roadmap is to move to
per-user public-key wrapping for a shared vault key.

## 6. Credential Categories

MacMima supports:

- Server
- Website account
- API key
- Database
- Other

Both Personal Vault and Shared Vault can be filtered by category.

## 7. Database Credentials And Table Notes

Database credentials can include:

- Database type
- Host, port, database name
- Username and password
- Connection string
- Table name
- Table description
- Notes

These fields are part of the encrypted credential body before syncing to the backend.

Table names and descriptions can be copied quickly for AI coding tools, analytics tools,
or project documentation.

Example:

```text
users: stores login email, role, and status
credentials: stores credential ciphertext and sync metadata
invite_codes: controls team registration
```

## 8. Local API

The Local API can be enabled in personal settings. When enabled, the app listens on:

```text
http://127.0.0.1:<port>/v1/credentials
```

Other trusted local tools can push credentials with a Local API Key. See
[Local API](./LOCAL_API.md).

## 9. Admin Features

Admins can:

- View backend URL and workspace key
- Create invite codes
- Manage user active status
- Grant or revoke Shared Vault access

## 10. Safety Tips

- Do not share your master password.
- Share the workspace key only with members of the same team.
- Do not put plaintext secrets in titles, tags, or other metadata fields.
- Disable users after offboarding or project handoff.
- Use least-privilege API keys at the provider side.
- Regularly remove credentials that are no longer needed.
