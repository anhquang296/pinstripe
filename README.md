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

Fill in the four API secrets, each at least 16 characters:

- `SECRET_API_KEY`
- `ADMIN_API_KEY`
- `SYSTEM_API_KEY`
- `MANAGEMENT_API_KEY`

Generate one with:

```bash
openssl rand -hex 16
```

Then `BETTER_AUTH_SECRET`, which signs the dashboard's session cookie and needs at least 32 characters:

```bash
openssl rand -hex 32
```

`GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` and `GOOGLE_OAUTH_ALLOWED_DOMAIN` may stay
empty — Google sign-in only turns on when all three are set. The remaining values in `.env.example`
already match the Docker ports below — leave them as they are.

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

## 6. Create the first admin

The admin UI signs in with a real session cookie — the Vite proxy forwards `/v1` to the API and
injects nothing, so a build outside `vite dev` authenticates with exactly what it has. Sign-up does
not exist on the server, so the first admin is created from the command line. The script is
idempotent:

```bash
pnpm --filter @pinstripe/api bootstrap-admin -- --email admin@pinstripe.test --name Admin --password '<at least 12 characters>'
```

Sign in at http://localhost:5173 with that email and password. Every other user is created in the
dashboard at `/admin/users`; there is no delete — demoting or disabling goes through an update, so the
last-active-admin rule still holds.

## 7. Optional — customer portal env

`apps/portal-ui` is a Next.js app and does not read the root `.env`. Customers sign in with a one-time
link sent to their billing email; the Next.js server holds the keys and the browser only gets an
httpOnly cookie. Create `apps/portal-ui/.env.local`:

```
PINSTRIPE_API_URL=http://localhost:3000
PINSTRIPE_PORTAL_API_KEY=<same value as PORTAL_API_KEY>
```

Never give it `PINSTRIPE_SECRET_API_KEY`. Sign-in links land in mailpit (http://localhost:58025).

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
pnpm dev:stop     # free the dev ports after a `pnpm dev` that did not shut down cleanly
pnpm docker:down  # stop the infrastructure containers
```

## `EADDRINUSE` on a port you are not using

`turbo dev` does not always kill its whole process tree on Ctrl-C, so a run can leave a `next-server`,
a `vite` or a worker behind still holding its port. The next `pnpm dev` then fails with
`EADDRINUSE: address already in use :::3100` — the port is held by an earlier run of this project, not
by another app.

```bash
pnpm dev:stop
```

It kills whatever is listening on `3000`–`3006`, `3100` and `5173`, together with the `node` and `pnpm`
processes that would otherwise respawn it. It stops walking up at the shell, so your terminal and any
other session survive, and it never touches Docker — when a port is published by a container, `lsof`
names `com.docker.backend`, and killing that would take down Docker Desktop. Use `pnpm docker:down` for
the containers.

It stops **every** dev process of this repo, including one another terminal is still using.
