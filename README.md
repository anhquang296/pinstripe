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

```bash
pnpm db:migrate
```

To wipe everything and start a fresh test run — drops the schema, replays every migration, and clears the
app's Redis keys:

```bash
pnpm db:reset
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

## Understanding the system

[docs/usecases/](docs/usecases/00-index.md) is the easiest way in. Each file follows one real
scenario — a customer onto a plan, an invoice issued and collected, a declined card chased by
dunning — from the click in admin-ui down through the API, the transaction, and the workers it wakes,
saying plainly what is done by the time the response returns and what only happens seconds later.
Every use case ends with the UI steps, the equivalent curl, and the SQL to see the rows for yourself.

[docs/flows/](docs/flows/00-index.md) walks each mechanism instead — request lifecycle, the outbox and
webhook pipeline, billing, payments, the ledger — with every step linked to the file and line that
implements it. Read it when a use case points you at the machinery. Both beat the ADRs as a starting
point: those record decisions rather than mechanics.

[docs/PITFALLS.md](docs/PITFALLS.md) collects the places where the code runs fine but the money comes
out wrong, and what a green test run does and does not prove. Read it before your first change and
before writing your first test.

## Useful commands

```bash
pnpm build        # build every package and app
pnpm typecheck    # type-check the whole monorepo
pnpm lint         # lint the whole monorepo
pnpm test         # run the test suites
pnpm db:generate  # generate a new migration from schema changes
pnpm docker:down  # stop the infrastructure containers
```
