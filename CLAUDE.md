# Keytra

Minimalist, self-hosted, open-source alternative to Crowdin.
Stack: Next.js (App Router, strict TS, Tailwind, `output: "standalone"`), Drizzle ORM, PostgreSQL 16, pnpm.

@AGENTS.md

## Scope (strict MVP)

- No Git sync, no SMTP/email delivery, no AI/machine translation.
- No feature creep: build only what was explicitly requested. Note ideas, don't implement them.
- No new dependencies for things the platform or existing libraries already do.

## UI

- Dark mode first, ultra-minimal: dark neutral/zinc tones, fine 1px borders, hardly any shadows or color.
- Monospace for translation keys, locale codes, API keys and other codes.
- UI strings are currently German.

## Architecture

- Fetch data in Server Components only.
- Mutate through Server Actions or clearly scoped Route Handlers (`src/app/api/...`).
- All DB queries are type-safe through Drizzle (`@/db`); no raw SQL outside migrations (exception: the health check's `SELECT 1`).
- Change the schema only in `src/db/schema.ts`, then run `pnpm db:generate` (SQL lands in `drizzle/`).

## Layout

- `src/app/` routes · `src/db/` schema, client, migrator · `src/lib/{auth,i18n,api,editor,projects,users}/` · `src/components/`

## Commands

- `pnpm db:up` / `db:down` / `db:reset`: dev Postgres (docker-compose.dev.yml)
- `pnpm db:generate` / `db:migrate` / `db:push` / `db:studio`
- `pnpm dev` / `build` / `start` / `test` / `lint` · Typecheck: `pnpm typecheck` (`next typegen` + `tsc --noEmit`)
