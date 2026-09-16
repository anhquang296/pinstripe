# Pinstripe

Step-by-step guide to run the project locally.

## Prerequisites

- **Node.js >= 22**
- **pnpm 10.28.1** — `corepack enable` picks up the version pinned in `package.json`
- **Docker** — used for Postgres, Redis and Mailpit

## 1. Install dependencies

```bash
pnpm install
```

## 2. Create the env file

```bash
cp .env.example .env
```

Fill in the five secrets, each at least 16 characters:

- `SECRET_API_KEY`
- `ADMIN_API_KEY`
- `SYSTEM_API_KEY`
- `MANAGEMENT_API_KEY`
- `WEBHOOK_SIGNING_SECRET`

Generate one with:

```bash
openssl rand -hex 16
```

The remaining values in `.env.example` already match the Docker ports below — leave them as they are.

## 3. Start the infrastructure

```bash
pnpm docker:up
```

This starts Postgres (`55432`), Redis (`56379`) and Mailpit (SMTP `51025`, web UI `58025`).

The compose file lives at `docker/compose.yml`, so a bare `docker compose up` will not find it — use the script above. Stop it later with `pnpm docker:down`.

## 4. Run database migrations

`pnpm db:migrate` reads plain `process.env` and does not load `.env` itself, so export the variables first:

```bash
set -a && source .env && set +a && pnpm db:migrate
```

## 5. Start everything

```bash
pnpm dev
```

Turbo builds `packages/core` first, then runs the API, the workers, the admin UI and the customer portal.

## 6. Optional — customer portal env

`apps/portal-ui` is a Next.js app and does not read the root `.env`. To use it, create `apps/portal-ui/.env.local`:

```
PINSTRIPE_API_URL=http://localhost:3000
PINSTRIPE_SECRET_API_KEY=<same value as SECRET_API_KEY>
```

## Local URLs

| Service   | URL                    |
| --------- | ---------------------- |
| API       | http://localhost:3000  |
| Admin UI  | http://localhost:5173  |
| Portal UI | http://localhost:3100  |
| Mailpit   | http://localhost:58025 |
| Postgres  | localhost:55432        |
| Redis     | localhost:56379        |

Workers run on ports `3001`–`3006`: outbox, domain-event, ledger, billing, webhook, dunning.

## Useful commands

```bash
pnpm build        # build every package and app
pnpm typecheck    # type-check the whole monorepo
pnpm lint         # lint the whole monorepo
pnpm test         # run the test suites
pnpm db:generate  # generate a new migration from schema changes
pnpm docker:down  # stop the infrastructure containers
```
