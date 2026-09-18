import type { UserRole } from '@contracts/users.types';
import { UserRoleEnum } from '@contracts/users.types';
import { sql } from 'drizzle-orm';
import { boolean, index, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

function authTimestamp(name: string) {
  return timestamp(name, { withTimezone: true, mode: 'date' });
}

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    emailVerified: boolean('email_verified').notNull().default(false),
    image: text('image'),
    role: text('role').$type<UserRole>().notNull().default(UserRoleEnum.MEMBER),
    banned: boolean('banned').notNull().default(false),
    banReason: text('ban_reason'),
    banExpires: authTimestamp('ban_expires'),
    createdAt: authTimestamp('created_at')
      .notNull()
      .default(sql`now()`),
    updatedAt: authTimestamp('updated_at')
      .notNull()
      .default(sql`now()`),
  },
  (table) => {
    return [
      uniqueIndex('users_email_idx').on(table.email),
      index('users_created_at_id_idx').on(table.createdAt, table.id),
    ];
  },
);

export const adminSessions = pgTable(
  'admin_sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(
        () => {
          return users.id;
        },
        { onDelete: 'cascade' },
      ),
    token: text('token').notNull(),
    expiresAt: authTimestamp('expires_at').notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    impersonatedBy: text('impersonated_by'),
    createdAt: authTimestamp('created_at')
      .notNull()
      .default(sql`now()`),
    updatedAt: authTimestamp('updated_at')
      .notNull()
      .default(sql`now()`),
  },
  (table) => {
    return [
      uniqueIndex('admin_sessions_token_idx').on(table.token),
      index('admin_sessions_user_id_idx').on(table.userId),
    ];
  },
);

export const userAccounts = pgTable(
  'user_accounts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(
        () => {
          return users.id;
        },
        { onDelete: 'cascade' },
      ),
    providerId: text('provider_id').notNull(),
    accountId: text('account_id').notNull(),
    password: text('password'),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: authTimestamp('access_token_expires_at'),
    refreshTokenExpiresAt: authTimestamp('refresh_token_expires_at'),
    scope: text('scope'),
    createdAt: authTimestamp('created_at')
      .notNull()
      .default(sql`now()`),
    updatedAt: authTimestamp('updated_at')
      .notNull()
      .default(sql`now()`),
  },
  (table) => {
    return [
      uniqueIndex('user_accounts_provider_id_account_id_idx').on(table.providerId, table.accountId),
      index('user_accounts_user_id_idx').on(table.userId),
    ];
  },
);

export const authVerifications = pgTable(
  'auth_verifications',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: authTimestamp('expires_at').notNull(),
    createdAt: authTimestamp('created_at')
      .notNull()
      .default(sql`now()`),
    updatedAt: authTimestamp('updated_at')
      .notNull()
      .default(sql`now()`),
  },
  (table) => {
    return [index('auth_verifications_identifier_idx').on(table.identifier)];
  },
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type AdminSession = typeof adminSessions.$inferSelect;
