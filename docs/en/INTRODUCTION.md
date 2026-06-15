# MacMima Product Introduction

MacMima is a desktop credential vault for AI developers and small development teams.
It is not just another general password manager. It is designed to organize developer
credentials, server access, database accounts, Markdown request docs, database table notes,
developer discussion, and team-shared configuration in one encrypted workspace.

## Why MacMima Exists

New AI developers quickly collect many sensitive items:

- Model provider API keys
- Vector database, business database, and cache service accounts
- Cloud server SSH private keys, usernames, ports, and notes
- Admin accounts, test accounts, webhook secrets
- Shared environment and configuration notes
- API request docs, debugging notes, and reusable code snippets
- Database table names, field meanings, and usage notes

If those items are scattered across chat history, spreadsheets, browser autofill, or notes,
teams run into predictable problems:

- They are hard to find.
- Plaintext copy-paste and screenshots increase leakage risk.
- Team onboarding is messy.
- There is no stable relationship between backends, databases, tables, and secrets.

MacMima is intended to be a developer credential workspace for AI projects.

## The Most Important Security Point

MacMima does not store plaintext passwords, plaintext API keys, or plaintext SSH private
keys directly in the backend database.

Credential bodies are encrypted in the desktop app before upload. The backend database stores:

- `encryptedData`: ciphertext
- `iv`: AES-GCM random initialization vector
- `authTag`: AES-GCM authentication tag
- metadata such as title, category, tags, and timestamps

The backend database should not contain plaintext database passwords, website passwords,
API keys, or SSH private keys. If only the database leaks, an attacker obtains ciphertext
and metadata, not directly usable credentials.

MacMima Crypto v2 adds:

- A Personal Vault local enhancement secret that is not sent to the backend.
- A separate Shared Vault encryption secret for new shared records instead of binding new
  shared data to the workspace key.
- Compatibility for old records, so teams can gradually edit and save old shared credentials
  to re-encrypt them with Crypto v2.

Metadata is intentionally visible for listing and search. Do not put real secrets in titles
or tags.

## Who It Is For

- Individual developers building AI apps
- Developers managing many model-provider API keys
- Small teams that frequently use servers, databases, and admin systems
- Teams that prefer self-hosting over sending all secrets to a third-party SaaS
- AI project teams that want database accounts and table descriptions in the same context

## Core Scenarios

### Personal Vault

The Personal Vault stores credentials that only the current user should decrypt, such as
personal API keys, test servers, and personal database accounts. Credential bodies are encrypted
locally with a key derived from the user's master password before upload.

### Shared Vault

The Shared Vault is for team collaboration. Admins can decide which users are allowed to
access the shared area. Members of the same backend and workspace key can use shared
configuration for development collaboration and handoff.

With Crypto v2, Shared Vault data can be encrypted with a team-configured Shared Vault secret.
Do not store that secret in backend environment variables, chat history, or repositories.

### Database Relationship Notes

Database credentials can include table names and table descriptions. This is useful when
connecting AI coding tools, RAG systems, analytics workflows, or admin panels to a database.

### Local API Import

The desktop app can expose a local API. Trusted local tools can push credentials into
MacMima without manual copy-paste. The desktop app still encrypts the payload before saving
it through the backend.

### Markdown Documents

Developers can store Markdown request docs, API notes, SQL, Shell, JSON, YAML, and code blocks.
Document bodies are encrypted locally just like credential bodies, and they can be shared through
the Shared Vault.

### Developer Discussion

Workspace members can discuss API details, requirements, and collaboration issues in Developer
Discussion. It supports images, `@` mentions for online members, new-message notifications,
date folding, and paginated history loading. Messages pass through basic sensitive-word masking,
but discussion should not be used to send plaintext secrets.

## Website Demo

[https://macmima.flnxi.com](https://macmima.flnxi.com)

The website demonstrates the product and provides download entry points. The app backend
is still intended to be self-hosted by teams unless a hosted service is explicitly provided.
