import { boolean, index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const products = pgTable(
  'products',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    active: boolean('active').notNull().default(true),
    unitLabel: text('unit_label').notNull().default(''),
    metadata: jsonb('metadata').$type<Record<string, string>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [index('products_created_at_id_idx').on(table.createdAt, table.id)],
);

export type ProductEntity = typeof products.$inferSelect;
export type NewProductEntity = typeof products.$inferInsert;
