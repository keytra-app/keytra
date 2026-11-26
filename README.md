# Keytra

Minimalist, self-hosted, open-source alternative to Crowdin.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/keytra-app/keytra/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/keytra-app/keytra/actions/workflows/ci.yml)
[![GitHub Release](https://img.shields.io/github/v/release/keytra-app/keytra)](https://github.com/keytra-app/keytra/releases)
[![GHCR](https://img.shields.io/badge/ghcr.io-keytra--app%2Fkeytra-2496ED?logo=docker&logoColor=white)](https://github.com/keytra-app/keytra/pkgs/container/keytra)

![Keytra Editor](docs/screenshot.png)

## Why Keytra?

- **Single Docker stack:** one app container and PostgreSQL. Migrations run on start.
- **JSON-first:** import, export, push and pull nested or flat JSON files.
- **Zero-SMTP:** no mail server. Users join through invite links you share yourself.
- **Keyboard-driven dark UI:** search, save and move between keys without the mouse.

## Features

- Projects with a source locale, any number of target locales, and namespaces.
- Web editor with status filters (translated, missing, outdated), key search, reference locales and placeholder checks (`{name}`, `{{name}}`, `%s`, `$1`, …).
- Changing a source text marks its translations as outdated.
- JSON import with preview, optional pruning of source keys; JSON export per locale and namespace, or everything as ZIP.
- Roles `admin` and `translator`, single-use invite links (valid for 7 days), per-project translator access.
- Per-project API keys (stored hashed) and a REST API for CI/CD.
- Progress overview per locale.

Keyboard shortcuts in the editor (`Ctrl` instead of `⌘` on Windows and Linux):

| Shortcut | Action |
|---|---|
| `⌘ K` | Focus key search |
| `⌘ Enter` | Save and jump to the next open key |
| `Alt ↑` / `Alt ↓` | Previous / next key |

> The web interface is currently available in German only.

## Quickstart (self-hosting with Docker Compose)

You do not need to clone the repository. Save this as `docker-compose.yml`:

```yaml
name: keytra-prod

services:
  keytra:
    image: ghcr.io/keytra-app/keytra:latest
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: ${DATABASE_URL:-postgres://keytra:${POSTGRES_PASSWORD:-keytra}@postgres:5432/keytra}
      AUTH_SECRET: ${AUTH_SECRET:-}
      APP_URL: ${APP_URL:-http://localhost:3000}
      ADMIN_EMAIL: ${ADMIN_EMAIL:-}
      ADMIN_PASSWORD: ${ADMIN_PASSWORD:-}
      ADMIN_NAME: ${ADMIN_NAME:-}
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-q", "-O", "/dev/null", "http://127.0.0.1:3000/api/health"]
      interval: 10s
      timeout: 6s
      retries: 3
      start_period: 30s

  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: keytra
      # Only applied when the volume is first created. Use URL-safe characters.
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-keytra}
      POSTGRES_DB: keytra
    volumes:
      - keytra_pg_data:/var/lib/postgresql/data
    healthcheck:
      # -h forces TCP: the temporary server during first-time init only listens on the socket.
      test: ["CMD-SHELL", "pg_isready -h 127.0.0.1 -U keytra -d keytra"]
      interval: 5s
      timeout: 5s
      retries: 20

volumes:
  keytra_pg_data:
```

Set a database password before the first start, then start the stack:

```bash
echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)" >> .env
```

```bash
docker compose up -d
```

Open <http://localhost:3000/setup> and create the first admin account.

> **Warning:** Until a user exists, anyone who can reach `/setup` can become admin. Complete the setup (or set `ADMIN_EMAIL` and `ADMIN_PASSWORD`) before exposing the instance. Port 3000 is published on all interfaces; on the internet, run Keytra behind an HTTPS reverse proxy and set `APP_URL` to the `https://` URL.

Update:

```bash
docker compose pull && docker compose up -d
```

## Configuration

Put variables in a `.env` file next to `docker-compose.yml`.

| Variable | Required | Example | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes (preset in Compose) | `postgres://keytra:secret@db.example.com:5432/keytra` | PostgreSQL connection string. Override it only for an external database. |
| `AUTH_SECRET` | No | `openssl rand -base64 32` output | Reserved. Currently not read; sessions are stored in the database. |
| `APP_URL` | Recommended | `https://keytra.example.com` | Public base URL, used for invite links and snippets. `https://` enables secure cookies. Default: `http://localhost:3000`. |
| `ADMIN_EMAIL` | No | `admin@example.com` | Together with `ADMIN_PASSWORD`, creates the first admin while no user exists. |
| `ADMIN_PASSWORD` | No | a long random password | See `ADMIN_EMAIL`. |
| `ADMIN_NAME` | No | `Admin` | Display name of that admin. |
| `POSTGRES_PASSWORD` | Recommended (Compose) | `openssl rand -hex 24` output | Password of the bundled database. Default: `keytra`. Applied only when the volume is created. |

## REST API & CI/CD

Create an API key in the project's **API & CI/CD** tab and send it as `Authorization: Bearer ktr_…`.

| Endpoint | Description | Query parameters (first value is the default) |
|---|---|---|
| `POST /api/v1/projects/:slug/push` | Sync source texts from a flat or nested JSON body | `namespace=default`, `prune=false\|true` |
| `GET /api/v1/projects/:slug/pull/:locale` | Download translations as JSON | `namespace=default`, `format=nested\|flat`, `fallback=source\|empty` |
| `GET /api/v1/projects/:slug/status` | Progress per target locale | none |
| `GET /api/health` | App and database health (no authentication) | none |

> `prune=true` deletes keys of the namespace that are missing in the payload, including their translations.

Push source texts:

```bash
curl -fsS -X POST "https://keytra.example.com/api/v1/projects/my-app/push?namespace=common" \
  -H "Authorization: Bearer $KEYTRA_API_KEY" \
  -H "Content-Type: application/json" \
  --data-binary @locales/en.json
```

Pull a translation:

```bash
curl -fsS "https://keytra.example.com/api/v1/projects/my-app/pull/de?namespace=common" \
  -H "Authorization: Bearer $KEYTRA_API_KEY" \
  -o locales/de.json
```

## Local development

Requirements: Node.js 22.18 or newer, pnpm, Docker.

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

Seed logins (local only): `admin@keytra.local` / `admin1234`, `translator@keytra.local` / `trans1234`.

See [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## License

[MIT](LICENSE)
