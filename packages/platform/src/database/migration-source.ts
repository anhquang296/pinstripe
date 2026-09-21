import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import { DatabaseSchemaEnum } from '@type/database-schema';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

export const MIGRATIONS_SCHEMA = 'drizzle';

export interface MigrationSource {
  migrationsFolder: string;
  migrationsTable: string;
  migrationsSchema: string;
}

export function buildMigrationSource(
  packageName: string,
  migrationsTable: string,
): MigrationSource {
  const packageJsonPath = createRequire(import.meta.url).resolve(`${packageName}/package.json`);

  return {
    migrationsFolder: join(dirname(packageJsonPath), 'migrations'),
    migrationsTable,
    migrationsSchema: MIGRATIONS_SCHEMA,
  };
}

export const platformMigrationSource = buildMigrationSource(
  '@vxrerp/platform',
  '__platform_migrations',
);

export async function migrateDatabase(
  databaseUrl: string,
  migrationSources: readonly MigrationSource[],
): Promise<void> {
  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });

  try {
    for (const migrationSource of migrationSources) {
      await migrate(drizzle(sql), migrationSource);
    }
  } finally {
    await sql.end();
  }
}

export async function dropDatabaseSchemas(databaseUrl: string): Promise<void> {
  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });

  try {
    for (const schemaName of [...Object.values(DatabaseSchemaEnum), MIGRATIONS_SCHEMA, 'public']) {
      await sql.unsafe(`drop schema if exists "${schemaName}" cascade`);
    }

    await sql.unsafe('create schema public');
  } finally {
    await sql.end();
  }
}
