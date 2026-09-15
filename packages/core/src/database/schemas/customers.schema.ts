import type { CustomerResponse as CustomerContract } from '@contracts/customers.types';
import type { Currency } from '@utils/currency';
import { sql } from 'drizzle-orm';
import { bigint, index, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export const customers = pgTable(
  'customers',
  {
    id: text('id').primaryKey(),
    email: text('email'),
    name: text('name').notNull().default(''),
    description: text('description').notNull().default(''),
    phone: text('phone').notNull().default(''),
    taxId: text('tax_id'),
    address: jsonb('address').$type<NonNullable<CustomerContract['address']>>(),
    currency: text('currency').$type<Currency>().notNull(),
    testClockId: text('test_clock_id'),
    balance: bigint('balance', { mode: 'number' }).notNull().default(0),
    metadata: jsonb('metadata').$type<Record<string, string>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => {
    return [
      index('customers_created_at_id_idx').on(table.createdAt, table.id),
      uniqueIndex('customers_email_idx')
        .on(table.email)
        .where(sql`deleted_at is null and email is not null`),
    ];
  },
);

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
