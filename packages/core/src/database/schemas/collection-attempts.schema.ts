import type { CollectionAttemptStatus } from '@contracts/collection-attempts.types';
import type { CollectionMethod } from '@contracts/subscriptions.types';
import { isoTimestamp } from '@database/columns/iso-timestamp';
import { invoices } from '@database/schemas/invoices.schema';
import { sql } from 'drizzle-orm';
import { bigint, index, pgTable, text } from 'drizzle-orm/pg-core';

export const collectionAttempts = pgTable(
  'collection_attempts',
  {
    id: text('id').primaryKey(),
    invoiceId: text('invoice_id')
      .notNull()
      .references(() => {
        return invoices.id;
      }),
    collectionMethod: text('collection_method').$type<CollectionMethod>().notNull(),
    requestedAmount: bigint('requested_amount', { mode: 'number' }).notNull(),
    appliedAmount: bigint('applied_amount', { mode: 'number' }).notNull().default(0),
    status: text('status').$type<CollectionAttemptStatus>().notNull(),
    externalReference: text('external_reference'),
    failureMessage: text('failure_message'),
    createdAt: isoTimestamp('created_at')
      .notNull()
      .default(sql`now()`),
    updatedAt: isoTimestamp('updated_at')
      .notNull()
      .default(sql`now()`),
  },
  (table) => {
    return [index('collection_attempts_invoice_id_status_idx').on(table.invoiceId, table.status)];
  },
);

export type CollectionAttempt = typeof collectionAttempts.$inferSelect;
export type NewCollectionAttempt = typeof collectionAttempts.$inferInsert;
