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

When you save a website password, database password, API key, SSH private key, Markdown document,
or connection string, the desktop app first:

1. Derives a Personal Vault key from the master password, or uses the Shared Vault secret
   for shared records.
2. If Crypto v2 is enabled, the local enhancement secret is added to Personal Vault encryption,
   and shared records use a separate Shared Vault encryption secret.
3. Encrypts the credential body with AES-GCM.
4. Uploads only ciphertext, IV, authentication tag, and necessary metadata.

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
- Plaintext Markdown document bodies
- Plaintext table relationship details

Put real secrets inside the credential body, not in titles or tags.

## 4. Personal Vault

Use the Personal Vault for:

- Personal model provider API keys
- Personal SSH/server access
- Personal database accounts
- Test admin accounts
- Private development configuration

Personal Vault bodies are encrypted with a key derived from the master password. With Crypto v2,
the app can also add a local enhancement secret. That secret is stored only on the current device
and is not uploaded to the backend.

Important: before moving to a new computer or reinstalling the system, back up or import the
local enhancement secret. Otherwise, the new device can read old v1 data but cannot decrypt new
Personal Vault records encrypted with that local enhancement secret.

## 5. Shared Vault

Use the Shared Vault for:

- Team development environment configuration
- Shared database accounts
- Shared test accounts
- Team API keys
- Project handoff notes

Admins can grant or revoke Shared Vault access in user management.

New Shared Vault data should use the Crypto v2 Shared Vault encryption secret. Team members
configure the same secret in personal settings. This secret is not sent to the backend as a
request header; the backend stores only shared ciphertext and metadata.

Historical v1 shared data remains readable through the compatibility path. Admins should
gradually edit and save old shared credentials again so they are re-encrypted with Crypto v2.
The roadmap is still to move to per-user public-key wrapping for shared vault keys.

## 6. Credential Categories

MacMima supports:

- Server
- Website account
- API key
- Database
- Markdown document
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

## 8. Markdown Documents

Use the document category for:

- API request examples
- API response notes
- AI-tool prompts and context
- Project handoff notes
- Common SQL, Shell, JSON, or YAML snippets

Markdown document bodies are encrypted credential bodies and can include fenced code blocks.
When copying a document, MacMima tries to copy only the body, reducing extra title/tag noise
before pasting into AI coding tools or team chat.

Documents can also be saved into the Shared Vault for workspace members.

## 9. Developer Discussion

Developer Discussion is for workspace members to talk about requirements, API details, and
collaboration issues. It supports:

- Text messages
- Pasted or uploaded images
- Typing `@` to select online members
- New-message notifications
- Date folding and paginated history loading

Messages pass through a basic sensitive-word masking layer, but discussion is not a secrets
vault. Do not send plaintext passwords, API keys, SSH private keys, or Shared Vault secrets
in chat.

## 10. Local API

The Local API can be enabled in personal settings. When enabled, the app listens on:

```text
http://127.0.0.1:<port>/v1/credentials
```

Other trusted local tools can push credentials with a Local API Key. See
[Local API](./LOCAL_API.md).

The Local API also supports `category: "document"` for Markdown documents and `scope: "shared"`
for saving into the Shared Vault.

## 11. Admin Features

Admins can:

- View backend URL and workspace key
- Create invite codes
- Manage user active status
- Grant or revoke Shared Vault access

## 12. Safety Tips

- Do not share your master password.
- Share the workspace key only with members of the same team.
- Back up Crypto v2 local enhancement and Shared Vault secrets separately, and never commit them.
- Do not put plaintext secrets in titles, tags, or other metadata fields.
- Do not send plaintext secrets in Developer Discussion.
- Disable users after offboarding or project handoff.
- Use least-privilege API keys at the provider side.
- Regularly remove credentials that are no longer needed.
