---
description: >
  Index of the conventions this repository enforces, and where each one lives.
agentkit:
  id: core/index
  layer: core
  generated: true
---

# Conventions in this repository

These rules are the source of truth for how code here is written. Where a rule and the surrounding
code disagree, the rule wins and the code is what needs fixing.

The rules marked `_always_` load every session and are in your context now. The rest load when you
touch a matching file **with a file tool** — a file authored through a shell redirection or a heredoc
loads none of them, and is never formatted. Read a scoped rule deliberately before writing in its
area, or run `agentkit rules --for <path>` to list what covers a path.

| rule | applies to | file |
|---|---|---|
| How an agent creates and changes files — the file tools write, the shell reads, and why a heredoc costs you the conventions and the formatter. | _always_ | `.claude/rules/agentkit/core/agent-tooling-convention.md` |
| Every body is a braced block — control flow and arrow functions alike, however short. | _always_ | `.claude/rules/agentkit/core/brace-style-convention.md` |
| No comments in source — why the code has to say it instead, and the tooling directives that are the only exception. | _always_ | `.claude/rules/agentkit/core/comment-convention.md` |
| Where a constant lives — the narrowest scope covering its use sites, and when it moves to `constants/`. | _always_ | `.claude/rules/agentkit/core/constant-convention.md` |
| Closed string sets as `<Name>Enum` plus a derived template-literal union, never a bare literal union. | _always_ | `.claude/rules/agentkit/core/enum-convention.md` |
| Which import path to write — alias by default, relative only within a folder's own subtree. | _always_ | `.claude/rules/agentkit/core/import-convention.md` |
| The shape of a log message — `<function>() <message>`, `[<Class>] <method>() <message>`, errors at error level with the cause under `error`. | _always_ | `.claude/rules/agentkit/core/logging-convention.md` |
| Do not build surface nobody reads — return the object you have, drop parameters no consumer touches. | _always_ | `.claude/rules/agentkit/core/minimal-surface-convention.md` |
| The vocabulary every other rule assumes — which word to pick when two would do. | _always_ | `.claude/rules/agentkit/core/naming-convention.md` |
| Read a deep path once into a named local — never an optional-chain ladder, and never the same path walked twice. | _always_ | `.claude/rules/agentkit/core/nested-access-convention.md` |
| Database schema design — a column is `NOT NULL` until absence is a real domain state, `''` / `0` / a sentinel date never stand in for unknown, and the type mirrors the column. | _always_ | `.claude/rules/agentkit/core/nullability-convention.md` |
| How agent-facing docs are owned and changed — which files are generated, which are the project's own, and the house style every rule follows. | _always_ | `.claude/rules/agentkit/core/rule-maintenance.md` |
| How a statement is written — one job per statement, happy path first in the affirmative. | _always_ | `.claude/rules/agentkit/core/statement-convention.md` |
| What to test and what to skip, and how a test file is shaped — AAA, flat structure, setup functions over beforeEach, names that state the scenario. | _always_ | `.claude/rules/agentkit/core/testing.md` |
| TypeScript settings and type discipline — strictness, no `any`, schema-derived types, error classes over generic Error. | _always_ | `.claude/rules/agentkit/core/typescript.md` |
| The queue contract shared by producer and consumer, and how a worker process is named, started and shut down. | `**/*.queue.ts`, `**/queues/**`, `**/workflows/**`, `**/*.processor.ts` | `.claude/rules/agentkit/profiles/bullmq/queue-convention.md` |
| The migration journal invariant — what a generated migration consists of, and why discarding one halfway breaks every test run. | `**/migrations/**`, `**/drizzle.config.*` | `.claude/rules/agentkit/profiles/drizzle/migration-convention.md` |
| Drizzle schema and query rules — table and column naming, inferred types, read/write split, soft deletes, and building a where from conditional terms. | `**/*.schema.ts`, `**/*.repository.ts`, `**/database/**`, `**/db/**` | `.claude/rules/agentkit/profiles/drizzle/query-convention.md` |
| What a Fastify plugin is allowed to contain — config in, a decorated client out, registered in one ordered list that is the source of truth. | `**/*.plugin.ts`, `**/plugins/**`, `**/app.ts` | `.claude/rules/agentkit/profiles/fastify/plugin-convention.md` |
| How routes are grouped and guarded — one submodule per caller with its own prefix and auth hook, a schema on every route, handlers that only wire. | `**/*.routes.ts`, `**/routes/**`, `**/hooks/**` | `.claude/rules/agentkit/profiles/fastify/route-convention.md` |
| Reach for lodash first — `_.get` over optional chaining, `_.map` / `_.filter` / `_.reject` over the native methods, and a chain when several run in sequence. | `**/*.ts`, `**/*.tsx`, `**/*.js`, `**/*.jsx`, `**/*.mjs`, `**/*.cjs` | `.claude/rules/agentkit/profiles/lodash/usage-convention.md` |
| Why a shared workspace package must stay built, and how apps are allowed to reach into it. | `**/*.ts`, `**/*.tsx`, `**/tsconfig*.json`, `**/package.json` | `.claude/rules/agentkit/profiles/monorepo-turborepo/shared-package-build.md` |
| How a repository is shaped — one aggregate per class, a closed verb set, filters whose field names carry their operator, and raw entities out. | `**/*.repository.ts`, `**/repositories/**` | `.claude/rules/agentkit/profiles/node-backend/repository-convention.md` |
| Naming and layout for request/response schemas and the types derived from them — camelCase schemas, suffix matching HTTP position, no intermediate fragments. | `**/*.types.ts`, `**/*.schema.ts` | `.claude/rules/agentkit/profiles/node-backend/schema-type-convention.md` |
| How a third-party SDK wrapper is shaped — named after the SDK, `(config, logger)`, no env, no I/O in the constructor, its own error class. | `**/*.client.ts`, `**/clients/**` | `.claude/rules/agentkit/profiles/node-backend/sdk-client-convention.md` |
| What a service owns — the verb that states the read's outcome, throwing what the repository returned as null, and the response envelope boundary. | `**/*.service.ts`, `**/services/**` | `.claude/rules/agentkit/profiles/node-backend/service-convention.md` |
| The frontend's HTTP layer — one client in one file, a folder per domain, stateless request functions, and the response envelope kept visible. | `**/api/**`, `**/api-v1/**`, `**/request.ts` | `.claude/rules/agentkit/profiles/react/api-client-convention.md` |
| How a React component file is shaped — PascalCase file, one default export, `{Component}Props`, `on*` props paired with `handleOn*` handlers, and when a file becomes a folder. | `**/*.tsx`, `**/*.jsx` | `.claude/rules/agentkit/profiles/react/component-convention.md` |
| React Hook Form + Zod — one config file per form, `useForm` in the page, the whole form object passed down, and a real `<form>` element. | `**/*-form.ts`, `**/forms/**`, `**/*Form.tsx`, `**/*Form/**` | `.claude/rules/agentkit/profiles/react/form-convention.md` |
| Server state through React Query — keys from a factory, `use{Entity}Query` / `use{Action}{Entity}Mutation`, invalidate then toast. | `**/reactquery/**`, `**/react-query-keys/**`, `**/queries.ts`, `**/mutations.ts` | `.claude/rules/agentkit/profiles/react/react-query-convention.md` |
| Requests composed from a closed set of setters — `Request<T>(Endpoint(…), Method(…), Params(…))`, empty values dropped, one error class at the boundary, refresh once and retry once. | `**/api/**`, `**/api-v1/**`, `**/request.ts` | `.claude/rules/agentkit/profiles/react/request-composition-convention.md` |

Conventions specific to this repository, which no other project shares, live in `.claude/rules/local/`.
Everything under `.claude/rules/agentkit/` is generated by agentkit — change it in the kit and re-sync, never
here.
