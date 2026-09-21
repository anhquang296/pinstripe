import type { DatabaseClient } from '@database/database.client';
import type { MigrationSource } from '@database/migration-source';
import { dropDatabaseSchemas, migrateDatabase } from '@database/migration-source';
import {
  loadTestEnv,
  readDatabaseName,
  readRequiredEnv,
  resolveAdminDatabaseUrl,
} from '@testing/test-env';
import { DatabaseSchemaEnum } from '@type/database-schema';
import { sql } from 'drizzle-orm';
import { Redis } from 'ioredis';
import _ from 'lodash';
import postgres from 'postgres';

interface TestDatabaseSetupOptions {
  envOverrides?: Record<string, string>;
}

export interface GlobalSetupContext {
  config: { env: Record<string, string | undefined> };
}

interface TableNameRow {
  [column: string]: unknown;
  schemaName: string;
  tableName: string;
}

async function ensureDatabase(databaseUrl: string): Promise<void> {
  const name = readDatabaseName(databaseUrl);
  const adminSql = postgres(resolveAdminDatabaseUrl(databaseUrl), { max: 1, onnotice: () => {} });

  try {
    const existingRows = await adminSql`select 1 from pg_database where datname = ${name}`;

    if (_.isEmpty(existingRows)) {
      await adminSql.unsafe(`create database "${name}"`);
    }
  } finally {
    await adminSql.end();
  }
}

async function flushRedis(): Promise<void> {
  const REDIS_SCAN_BATCH_SIZE = 1000;

  const redis = new Redis({
    host: readRequiredEnv('REDIS_HOST'),
    port: Number(readRequiredEnv('REDIS_PORT')),
    password: process.env.REDIS_PASSWORD,
  });

  const prefix = readRequiredEnv('REDIS_KEY_PREFIX');
  const stream = redis.scanStream({ match: `${prefix}:*`, count: REDIS_SCAN_BATCH_SIZE });

  for await (const keys of stream) {
    const batch = keys as string[];

    if (batch.length > 0) {
      await redis.unlink(...batch);
    }
  }

  await redis.quit();
}

export function createTestDatabaseSetup(
  migrationSources: readonly MigrationSource[],
  options: TestDatabaseSetupOptions = {},
): (context: GlobalSetupContext) => Promise<void> {
  const { envOverrides = {} } = options;

  return async ({ config }) => {
    const { TEST_SUITE_NAME } = config.env;

    if (TEST_SUITE_NAME) {
      process.env.TEST_SUITE_NAME = TEST_SUITE_NAME;
    }

    loadTestEnv(envOverrides);

    const databaseUrl = readRequiredEnv('DATABASE_URL');

    await ensureDatabase(databaseUrl);
    await dropDatabaseSchemas(databaseUrl);
    await migrateDatabase(databaseUrl, migrationSources);
    await flushRedis();

    process.stdout.write(
      `createTestDatabaseSetup() test database ready at ${readDatabaseName(databaseUrl)}\n`,
    );
  };
}

export async function truncateDatabase(database: DatabaseClient): Promise<void> {
  const schemaNames = Object.values(DatabaseSchemaEnum);

  const tableRows = await database.master.execute<TableNameRow>(sql`
    select table_schema as "schemaName", table_name as "tableName"
    from information_schema.tables
    where table_schema in ${schemaNames} and table_type = 'BASE TABLE'
  `);

  if (_.isEmpty(tableRows)) {
    throw new Error('truncateDatabase() found no tables, the test database is not migrated');
  }

  const targets = _([...tableRows])
    .map(({ schemaName, tableName }) => {
      return `"${schemaName}"."${tableName}"`;
    })
    .join(', ');

  await database.master.execute(sql.raw(`truncate ${targets} restart identity cascade`));
}
