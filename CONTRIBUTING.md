# Contributing to Keytra

## Scope

Keytra is deliberately minimal. Open an issue and wait for agreement **before** you start a larger feature. Bug fixes and small improvements can go straight to a pull request.

Out of scope: Git sync, SMTP or email delivery, AI or machine translation. Do not add a dependency for something the platform or an existing library already does.

## Development setup

Requirements: Node.js 22.18 or newer, pnpm (version in `package.json`), Docker.

```bash
cp .env.example .env.local
```

```bash
pnpm install
```

```bash
pnpm db:up
```

```bash
pnpm db:migrate
```

```bash
pnpm db:seed
```

```bash
pnpm dev
```

`pnpm db:reset` recreates the development database. It deletes all local data.

Seed logins (local only): `admin@keytra.local` / `admin1234`, `translator@keytra.local` / `trans1234`.

## Branches and pull requests

1. Fork the repository and branch from `master` (for example `fix/export-filename`).
2. Keep one topic per pull request.
3. Run the checks below.
4. Open a pull request against `master` and fill in the template.
5. Add user-visible changes to the `[Unreleased]` section of `CHANGELOG.md`.

## Required checks

```bash
pnpm test
```

```bash
pnpm typecheck
```

`pnpm typecheck` runs `next typegen` and then `tsc --noEmit`. On a fresh clone, `tsc --noEmit` fails without the generated route types.

```bash
pnpm lint
```

```bash
pnpm build
```

`pnpm build` needs `DATABASE_URL` (from `.env.local`); it does not connect to the database.

## Database migrations

- Change the schema only in `src/db/schema.ts`.
- Run `pnpm db:generate` and commit the new SQL file together with `drizzle/meta/`.
- Never edit or delete a migration that is already on `master`. Add a new one.
- Do not use `pnpm db:push` as a substitute for a migration.
- Migrations run automatically when the container starts, so they must be safe for existing data.

## Code conventions

- Fetch data in Server Components. Mutate through Server Actions or Route Handlers under `src/app/api/`.
- Query the database through Drizzle (`@/db`).
- UI: dark mode first, minimal; monospace for keys, locale codes and API keys. UI strings are currently German.
- Documentation and repository files are written in English.

## Reporting

- Bugs and feature requests: [GitHub issues](https://github.com/keytra-app/keytra/issues/new/choose).
- Security problems: see [SECURITY.md](SECURITY.md). Do not open a public issue.

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md). Contributions are licensed under the [MIT License](LICENSE).
