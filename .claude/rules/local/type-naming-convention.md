---
paths:
  - '**/*.types.ts'
  - '**/*.schema.ts'
  - '**/*.repository.ts'
  - '**/*.service.ts'
---

# Type Naming In This Repository

Two kit rules want the same name for two different things, and this file records which one wins where.

## The collision

`drizzle/query-convention.md` says a Drizzle select type is `{Entity}` and the insert type is
`New{Entity}`. `node-backend/schema-type-convention.md` says the type derived from an entity schema
is `{Noun}`. In a module package such as `@vxrerp/billing` both live in the same package — `customers.schema.ts` infers the
row and `contracts/customers.types.ts` derives the wire shape — so one of them has to move.

## The split

| Thing              | Name               | Declared in                            | Rule it follows                                                                                 |
| ------------------ | ------------------ | -------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Drizzle select row | `Customer`         | `database/schemas/customers.schema.ts` | drizzle/query-convention                                                                        |
| Drizzle insert row | `NewCustomer`      | same file                              | drizzle/query-convention                                                                        |
| Wire shape         | `CustomerResponse` | `contracts/customers.types.ts`         | naming-convention §Type suffixes — _"`…Response` — anything that crosses the wire to a client"_ |

The wire name is the one that moved, because `naming-convention.md` already has a suffix for it and
the drizzle rule has no alternative spelling to offer. Applies to all ten pairs: Customer, Product,
Price, Subscription, SubscriptionItem, Entitlement, TestClock, LedgerAccount, LedgerTransaction,
LedgerPosting.

A service therefore reads `Promise<CustomerResponse>` and maps from `Customer`, and the direction of
the mapping is legible from the names alone.

## Filter fields the kit table does not cover

`repository-convention.md` §Filter field naming lists equality, set membership, substring, range and
cursor. Two conditions here have no row in that table and keep an explicit operator suffix:

- `statusNe` — "every status except this one" (`findSubscriptions` excluding `canceled`).
- `customerIdIsNull` — the discriminant between a shared ledger account and a per-customer one,
  which is a real `IS NULL`, not an absent filter.
- `activeAt` — a row whose validity window covers this instant (`start_at <= value` **and**
  `end_at is null or end_at > value`), used by `findDiscounts`. Two columns and a null branch, so
  neither `…BeforeAt` nor `…AfterAt` describes it.

Everything else follows the table exactly: `email`, `active`, `status`, `productId` for equality,
`ids` for set membership, `beforeAt` / `afterAt` for cursors.

## NEVER Do

- Name a Drizzle row type `{Entity}Entity` — the suffix was removed on purpose.
- Give a wire type the bare entity noun — it collides with the row type in the same package.
- Add a new filter field whose operator is not readable from its name.
