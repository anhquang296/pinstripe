import { resolve } from 'node:path';

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { Redis } from 'ioredis';
import postgres from 'postgres';

import { loadTestEnv, readDatabaseName, readRequiredEnv, resolveAdminDatabaseUrl } from './env';

const MIGRATIONS_FOLDER = resolve(import.meta.dirname, '../migrations');
const REDIS_SCAN_BATCH_SIZE = 1000;

async function ensureDatabase(databaseUrl: string): Promise<void> {
  const name = readDatabaseName(databaseUrl);
  const sql = postgres(resolveAdminDatabaseUrl(databaseUrl), { max: 1, onnotice: () => {} });

  const existing = await sql`select 1 from pg_database where datname = ${name}`;

  if (existing.length === 0) {
    await sql.unsafe(`create database "${name}"`);
  }

  await sql.end();
}

async function resetSchema(databaseUrl: string): Promise<void> {
  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });

  await sql.unsafe('drop schema if exists public cascade');
  await sql.unsafe('drop schema if exists drizzle cascade');
  await sql.unsafe('create schema public');

  await migrate(drizzle(sql), { migrationsFolder: MIGRATIONS_FOLDER });
  await sql.end();
}

async function flushRedis(): Promise<void> {
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

export async function setup(): Promise<void> {
  loadTestEnv();

  const databaseUrl = readRequiredEnv('DATABASE_URL');

  await ensureDatabase(databaseUrl);
  await resetSchema(databaseUrl);
  await flushRedis();

  process.stdout.write(`setup() test database ready at ${readDatabaseName(databaseUrl)}\n`);
}
