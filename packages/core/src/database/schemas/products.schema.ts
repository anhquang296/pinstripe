import { isoTimestamp } from '@database/columns/iso-timestamp';
import { sql } from 'drizzle-orm';
import { boolean, index, jsonb, pgTable, text } from 'drizzle-orm/pg-core';

export const products = pgTable(
  'products',
  {
    id: text('id').primaryKey(),
    livemode: boolean('livemode').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    active: boolean('active').notNull().default(true),
    unitLabel: text('unit_label').notNull().default(''),
    metadata: jsonb('metadata').$type<Record<string, string>>().notNull().default({}),
    createdAt: isoTimestamp('created_at')
      .notNull()
      .default(sql`now()`),
    updatedAt: isoTimestamp('updated_at')
      .notNull()
      .default(sql`now()`),
    deletedAt: isoTimestamp('deleted_at'),
  },
  (table) => {
    return [index('products_created_at_id_idx').on(table.createdAt, table.id)];
  },
);

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
