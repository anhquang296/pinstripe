<!-- agentkit:start v0.6.7 -->
## Coding conventions

The rules below are the source of truth for how code here is written, and every one of them applies
to every file — none is scoped to a path. Where they and the code disagree, the rules win and the
code is what needs fixing. Do not infer a convention from surrounding code.

They are a floor, not a gate. Read them once and keep working; there is no per-file lookup step.

| rule | file |
|---|---|
| How an agent creates and changes files — the file tools write, the shell reads, and why a heredoc costs you the formatter. | `.claude/rules/agentkit/core/agent-tooling-convention.md` |
| Every body is a braced block — control flow and arrow functions alike, however short. | `.claude/rules/agentkit/core/brace-style-convention.md` |
| No comments in source — why the code has to say it instead, and the tooling directives that are the only exception. | `.claude/rules/agentkit/core/comment-convention.md` |
| Where a constant lives — the narrowest scope covering its use sites, and when it moves to `constants/`. | `.claude/rules/agentkit/core/constant-convention.md` |
| Closed string sets as `<Name>Enum` plus a derived template-literal union, never a bare literal union. | `.claude/rules/agentkit/core/enum-convention.md` |
| Which import path to write — alias by default, relative only within a folder's own subtree. | `.claude/rules/agentkit/core/import-convention.md` |
| The shape of a log message — `<function>() <message>`, `[<Class>] <method>() <message>`, errors at error level with the cause under `error`. | `.claude/rules/agentkit/core/logging-convention.md` |
| Do not build surface nobody reads — return the object you have, drop parameters no consumer touches. | `.claude/rules/agentkit/core/minimal-surface-convention.md` |
| How a name is built — the slots a name has, which word may fill each, and why a name never reports the step that produced it. | `.claude/rules/agentkit/core/naming-convention.md` |
| Read a path once into a named local, and give a field its fallback by destructuring it with a default — never `<object>.<field> ?? <default>`, with or without `?.`, and never the same path walked twice. | `.claude/rules/agentkit/core/nested-access-convention.md` |
| Database schema design — a column is `NOT NULL` until absence is a real domain state, `''` / `0` / a sentinel date never stand in for unknown, and the type mirrors the column. | `.claude/rules/agentkit/core/nullability-convention.md` |
| How agent-facing docs are owned and changed — which files are generated, which are the project's own, and the house style every rule follows. | `.claude/rules/agentkit/core/rule-maintenance.md` |
| How a statement is written — one job per statement, happy path first in the affirmative. | `.claude/rules/agentkit/core/statement-convention.md` |
| What to test and what to skip, and how a test file is shaped — AAA, flat structure, setup functions over beforeEach, names that state the scenario. | `.claude/rules/agentkit/core/testing.md` |
| TypeScript settings and type discipline — strictness, no `any`, schema-derived types, error classes over generic Error. | `.claude/rules/agentkit/core/typescript.md` |
| Which verb names an operation — `get` throws and `find` returns null, `delete` takes a record out of its store, `destroy` ends an object's life. | `.claude/rules/agentkit/core/verb-convention.md` |
| The fixed words for data crossing a boundary — `payload`, `filters`, `query`, `params`, and the type suffixes that mirror them. | `.claude/rules/agentkit/core/vocabulary-convention.md` |
| The queue contract shared by producer and consumer, and how a worker process is named, started and shut down. | `.claude/rules/agentkit/profiles/bullmq/queue-convention.md` |
| The migration journal invariant — what a generated migration consists of, and why discarding one halfway breaks every test run. | `.claude/rules/agentkit/profiles/drizzle/migration-convention.md` |
| Drizzle schema and query rules — table and column naming, inferred types, read/write split, soft deletes, and building a where from conditional terms. | `.claude/rules/agentkit/profiles/drizzle/query-convention.md` |
| What a Fastify plugin is allowed to contain — config in, a decorated client out, registered in one ordered list that is the source of truth. | `.claude/rules/agentkit/profiles/fastify/plugin-convention.md` |
| How routes are grouped and guarded — one submodule per caller with its own prefix and auth hook, a schema on every route, handlers that only wire. | `.claude/rules/agentkit/profiles/fastify/route-convention.md` |
| Reach for lodash first — `_.get` over optional chaining at any depth, `_.map` / `_.filter` / `_.reject` over the native methods, and a chain when several run in sequence. | `.claude/rules/agentkit/profiles/lodash/usage-convention.md` |
| Why a shared workspace package must stay built, and how apps are allowed to reach into it. | `.claude/rules/agentkit/profiles/monorepo-turborepo/shared-package-build.md` |
| How a repository is shaped — one aggregate per class, a closed verb set, filters whose field names carry their operator, and raw entities out. | `.claude/rules/agentkit/profiles/node-backend/repository-convention.md` |
| Naming and layout for request/response schemas and the types derived from them — camelCase schemas, suffix matching HTTP position, no intermediate fragments. | `.claude/rules/agentkit/profiles/node-backend/schema-type-convention.md` |
| How a third-party SDK wrapper is shaped — named after the SDK, `(config, logger)`, no env, no I/O in the constructor, its own error class. | `.claude/rules/agentkit/profiles/node-backend/sdk-client-convention.md` |
| What a service owns — the verb that states the read's outcome, throwing what the repository returned as null, and the response envelope boundary. | `.claude/rules/agentkit/profiles/node-backend/service-convention.md` |
| URL search params as the store — parsers declared once per screen, related params written together with `useQueryStates`, enum params from their enum, and the query key derived from the URL. | `.claude/rules/agentkit/profiles/nuqs/search-params-convention.md` |
| The frontend's HTTP layer — one client in one file, a folder per domain, stateless request functions, and the response envelope kept visible. | `.claude/rules/agentkit/profiles/react/api-client-convention.md` |
| How a React component file is shaped — PascalCase file, one default export, `{Component}Props`, `on*` props paired with `handleOn*` handlers, and when a file becomes a folder. | `.claude/rules/agentkit/profiles/react/component-convention.md` |
| React Hook Form + Zod — one config file per form, `useForm` in the page, the whole form object passed down, and a real `<form>` element. | `.claude/rules/agentkit/profiles/react/form-convention.md` |
| Server state through React Query — keys from a factory, `use{Entity}Query` / `use{Action}{Entity}Mutation`, invalidate then toast. | `.claude/rules/agentkit/profiles/react/react-query-convention.md` |
| Requests composed from a closed set of setters — `Request<T>(Endpoint(…), Method(…), Params(…))`, empty values dropped, one error class at the boundary, refresh once and retry once. | `.claude/rules/agentkit/profiles/react/request-composition-convention.md` |

Rules under `.claude/rules/agentkit/` are generated by [agentkit](https://github.com/anhquang296/agentkit) — edit them there, not here.
Project-specific conventions live in `.claude/rules/local/` and are never overwritten.
<!-- agentkit:end -->
