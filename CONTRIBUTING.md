# Contributing

Thanks for helping improve MacMima.

## Development Workflow

1. Fork the repository.
2. Create a feature branch.
3. Keep changes focused and small.
4. Run the relevant checks before opening a pull request.

## Checks

Desktop app:

```bash
pnpm install
pnpm exec tsc --noEmit
```

Backend:

```bash
cd server
pnpm install
npx prisma generate
pnpm build
pnpm audit --prod
```

## Pull Requests

Please include:

- What changed
- Why it changed
- How it was tested
- Any security or migration impact

Do not include production secrets, private keys, deployment logs, packaged
installers, local databases, or generated `node_modules`/`dist` artifacts.

## Code Style

TypeScript is preferred throughout the app and backend. ESLint cleanup is in
progress; new code should avoid `any` where practical and keep security-sensitive
logic explicit.
