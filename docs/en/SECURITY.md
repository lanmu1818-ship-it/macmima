# Security Model

MacMima stores highly sensitive developer credentials, so the security model must be explicit:
what goes to the backend, what never goes to the backend, what a database breach exposes,
and where the current design boundaries are.

## Short Answer

MacMima does not store plaintext website passwords, database passwords, API keys,
or SSH private keys in the backend database.

Credential bodies are encrypted in the desktop app before upload. The backend stores
ciphertext, IVs, authentication tags, and necessary metadata.

## What The Backend Database Stores

| Data | Stored plaintext in backend database? | Notes |
| --- | --- | --- |
| Website passwords, database passwords, API keys, SSH private keys, connection strings | No | Encrypted locally into `encryptedData` |
| Database table relations, table descriptions, credential notes | No | Treated as credential body and encrypted together |
| User master password | No | Never sent to the backend |
| Login verifier | No, not a plaintext password | Stored as an Argon2id verifier with `AUTH_PEPPER` |
| `encryptedData`, `iv`, `authTag` | Yes | Encrypted output required for sync and integrity checks |
| Title, category, tags, scope, timestamps | Yes | Metadata used for listing, search, and collaboration |

Do not put real secrets in credential titles or tags, because those fields are plaintext metadata.

## Personal Vault Protection

The Personal Vault uses a key derived from the user's master password:

1. The user enters the master password in the desktop app.
2. The desktop app derives an AES-GCM key with PBKDF2 and the user's salt.
3. Credential bodies are encrypted locally.
4. The backend receives only ciphertext, IV, authentication tag, and metadata.
5. Decryption happens only inside the unlocked desktop app.

The master password is not sent to the backend. If the user forgets the master password,
the backend cannot recover Personal Vault plaintext.

### Crypto v2 Local Enhancement Secret

MacMima Crypto v2 keeps old data compatible while adding a local enhancement secret for
new or edited Personal Vault records:

- The local enhancement secret is stored only on the desktop device and is not sent to the backend.
- Electron builds prefer the operating system backed `safeStorage` API for local configuration.
- New v2 Personal Vault ciphertext needs both the master-password-derived key and the local enhancement secret.
- If only the backend database leaks, the attacker is still missing this local-only material.
- When moving to another computer, the user must back up or import the local enhancement secret.
  If it is lost, data encrypted with it cannot be recovered.

Legacy v1 records remain readable. No database migration is required.

## Shared Vault Protection

The Shared Vault supports two modes:

| Mode | Description |
| --- | --- |
| v1 compatibility | Derives the shared key from the workspace key. Used for legacy shared records or teams that have not configured a Shared Vault secret |
| Crypto v2 | Uses a separate Shared Vault encryption secret. Team members configure the same value locally, and new shared records use that secret |

The Crypto v2 Shared Vault secret is not sent as the `X-MacMima-Workspace-Key` request header.
The workspace key remains an access and isolation key for the backend; the Shared Vault secret
is used only for client-side encryption and decryption.

Boundaries:

- If only the database leaks, the attacker still does not get shared-vault plaintext,
  because the workspace key is not stored plaintext in the database.
- For new v2 shared records, capturing only the workspace key is not enough to decrypt the Shared Vault.
- If the team sends the Shared Vault secret to backend logs, chat history, or a public repository,
  the v2 protection is defeated.
- A malicious client can still read plaintext before encryption; that supply-chain boundary exists
  for every client-side encryption tool.

The roadmap is still to move to per-user public-key wrapping for a random shared vault key,
which reduces the need for manual team secret distribution.

## Login Password Handling

MacMima does not send the plaintext master password to the backend, because the master
password is also used for local encryption.

Authentication flow:

1. The frontend computes a login verification hash from the master password and salt.
2. The backend stores that verifier after Argon2id hashing with `AUTH_PEPPER`.
3. During login, the backend verifies the Argon2id verifier.
4. On success, the backend issues a JWT.

The login verification hash acts as an authentication credential. Production deployments
must use HTTPS and must not log request bodies.

## If The MySQL Database Leaks

If an attacker only obtains the MySQL database:

- They cannot directly read website passwords, database passwords, API keys, or SSH private keys.
- They do not get the user master password.
- They can see credential titles, categories, tags, scope, and timestamps.
- They can see ciphertext, IVs, and authentication tags.
- They can see usernames, emails, salts, and login verifiers.

Database backups are still sensitive and should be encrypted, but a database leak is not
the same as a plaintext credential leak.

## If The Backend Is Fully Compromised

If an attacker controls the backend runtime, risk is higher than a database-only breach:

- They may tamper with API responses, sync behavior, and permissions.
- If request bodies are logged, login verification hashes or workspace keys may be exposed.
- v1 Shared Vault security may be affected if the workspace key is captured. v2 Shared Vault
  records also require the separate Shared Vault secret.
- Personal Vault plaintext still depends on the user's master-password-derived key; v2 records
  also require the local enhancement secret.

Recommended response:

- Take the service offline and preserve evidence.
- Rotate `JWT_SECRET`, `AUTH_PEPPER`, database passwords, and workspace keys.
- Check application, process, reverse-proxy, and access logs for request-body leakage.
- Force users to re-login and evaluate whether users should change master passwords.
- Rotate Shared Vault credentials at the provider side, such as API keys, database passwords,
  and SSH keys.
- If the Shared Vault encryption secret may have leaked, generate a new one and re-save shared
  credentials so they are re-encrypted.

## Local API Boundary

The Local API listens only on `127.0.0.1` and requires a Local API Key.

It does not bypass encryption and write plaintext directly to the backend. A Local API
request is passed to the unlocked desktop app, encrypted there, and then saved through
the backend API.

Recommendations:

- Disable the Local API when not needed.
- Do not commit the Local API Key to public repositories or shared scripts.
- Allow only trusted local tools to call it.

## Self-Hosting Recommendations

- Bind the backend to `127.0.0.1` and expose it through Caddy or Nginx with HTTPS.
- Keep MySQL bound to localhost.
- Use a dedicated low-privilege database user, not root.
- Use different long random values for `JWT_SECRET` and `AUTH_PEPPER`.
- Never commit `.env`.
- Do not log request bodies.
- Encrypt database backups.
- Run `pnpm audit --prod` regularly.

Generate random values:

```bash
openssl rand -base64 32
```

## Hardening Roadmap

- Replace manually shared Shared Vault secrets with per-user public-key wrapping.
- Add encrypted local backup and recovery-key flows.
- Add full Prisma migrations instead of production `db push`.
- Strengthen Electron sandboxing, code signing, and update-chain security.
- Finish lint cleanup and add stricter CI security checks.

## Reporting Vulnerabilities

Please do not disclose vulnerability details in a public issue.

Include:

- Description
- Reproduction steps
- Impact
- Affected version or commit
- Suggested fix, if any

If you fork or self-host MacMima and suspect that deployment config, database access,
object storage keys, JWT secrets, or `AUTH_PEPPER` leaked, rotate the affected secrets immediately.
