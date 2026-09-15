---
paths:
  - "**/*.schema.ts"
  - "**/migrations/**"
description: >
  When a column may be NULL and when it must not — NULL reserved for state, identity and
  not-applicable, empty string for optional free text, CHECK constraints for shape.
---

# Nullability Convention

A nullable column is a claim that "absent" is a state the business distinguishes. Where it is not,
the column carries a lie that every reader has to defend against.

## Scope

Applies to Drizzle schema files and the migrations that alter them.

Does **not** apply to TypeScript optional parameters or to request payloads, where `undefined` means
"the caller did not send this field" and is unrelated to storage.

## NULL is allowed for exactly four reasons

| Reason | Example | Why a sentinel fails |
| --- | --- | --- |
| **Lifecycle state** — the event has not happened yet | `deleted_at`, `published_at`, `locked_at`, `reversed_by_transaction_id` | No timestamp is safe as a sentinel: `1970-01-01` and `9999-12-31` both survive into a period query and quietly join a billing run |
| **Identity / foreign key absent** | `ledger_accounts.customer_id` (shared account) | `''` is not an id, and it defeats the partial indexes that separate shared from per-customer rows |
| **Unique index sparsity** | `ledger_transactions.external_id`, `customers.email`, `prices.lookup_key` | Postgres treats NULLs as distinct, so many rows may lack the key. With `''`, the second such row collides |
| **Not applicable to this row's shape** | `prices.unit_amount` on a tiered price | `0` is a legal amount in billing — a free plan. A numeric sentinel is indistinguishable from real data |

## Everything else is `NOT NULL DEFAULT ''`

Optional free text that the business reads as prose — a name, a description, a label, a nickname —
stores `''`, never NULL. One emptiness check, no three-valued logic in `LIKE` or `GROUP BY`, no
`COALESCE` in the invoice template, and `string` rather than `string | null` in every consumer.

The exception inside this group is a field where "never provided" is legally different from "none":
`customers.tax_id` stays nullable, because an invoice for a buyer with no tax code is not the same
document as an invoice whose tax code nobody captured.

## Not-applicable columns get a CHECK, not a comment

Where nullability depends on a discriminant column, the database enforces the combination. Service
validation is the first line; it does not survive a direct write, a backfill script or a future bug.

```sql
-- CORRECT — the illegal row cannot exist
ALTER TABLE prices ADD CONSTRAINT prices_per_unit_shape
  CHECK (billing_scheme <> 'per_unit' OR (unit_amount IS NOT NULL AND tiers IS NULL));
```

Name the constraint `{table}_{discriminant}_shape` so the violation message says which shape was
broken.

## Adding a NOT NULL column to a populated table

Three statements in one migration, in this order: `SET DEFAULT`, `UPDATE … WHERE … IS NULL`, then
`SET NOT NULL`. Drizzle generates the first and third only — the backfill is added by hand, and
without it the migration fails on the first non-empty environment.

## NEVER Do

- Store `0`, `-1`, `1970-01-01` or `9999-12-31` to avoid a NULL.
- Use `''` in a column that participates in a unique index, unless the index excludes it explicitly.
- Leave a shape rule (this column is required only when that column equals X) in the service alone.
- Generate a `SET NOT NULL` migration without the backfill statement in front of it.
