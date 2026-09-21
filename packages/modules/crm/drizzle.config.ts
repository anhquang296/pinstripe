import { defineConfig } from 'drizzle-kit';

const { DATABASE_URL = '' } = process.env;

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/database/schemas/*.schema.ts',
  out: './migrations',
  schemaFilter: ['crm'],
  migrations: {
    table: '__crm_migrations',
    schema: 'drizzle',
  },
  dbCredentials: {
    url: DATABASE_URL,
  },
  casing: 'snake_case',
  strict: true,
  verbose: true,
});
