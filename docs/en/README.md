# MacMima Documentation Index

This index organizes the main MacMima open-source documentation. If you are reading
the project for the first time, follow the recommended order below.

Chinese documentation: [docs/README.md](../README.md)

## Recommended Reading Order

1. [Product Introduction](./INTRODUCTION.md)
2. [Security Model](./SECURITY.md)
3. [App Usage Guide](./APP_USAGE.md)
4. [Backend Deployment](./BACKEND_DEPLOYMENT.md)
5. [Technical Overview](./TECHNICAL_OVERVIEW.md)
6. [Local API](./LOCAL_API.md)

## By Role

Individual developers:

- [Product Introduction](./INTRODUCTION.md)
- [App Usage Guide](./APP_USAGE.md)
- [Security Model](./SECURITY.md)

Self-hosting maintainers:

- [Backend Deployment](./BACKEND_DEPLOYMENT.md)
- [Security Model](./SECURITY.md)
- [Technical Overview](./TECHNICAL_OVERVIEW.md)

Tool integration developers:

- [Local API](./LOCAL_API.md)
- [Technical Overview](./TECHNICAL_OVERVIEW.md)

Contributors:

- [Contributing Guide](../../CONTRIBUTING.md)
- [Technical Overview](./TECHNICAL_OVERVIEW.md)
- [Security Model](./SECURITY.md)

## Important Security Note

The MacMima backend database does not store plaintext credential bodies. Website
passwords, database passwords, API keys, SSH private keys, and connection strings
are encrypted in the desktop app before they are synced to the backend.

Titles, categories, tags, and timestamps are plaintext metadata for listing and
search. Do not put real secrets in titles or tags.
