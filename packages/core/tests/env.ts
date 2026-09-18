import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import _ from 'lodash';

const ENV_FILE = resolve(import.meta.dirname, '../../../.env');
const TEST_NODE_ENV = 'test';
const TEST_LOG_LEVEL = 'fatal';
const DATABASE_NAME_PATTERN = /^[a-zA-Z0-9_]+$/;

function readEnvFile(): void {
  const contents = readFileSync(ENV_FILE, 'utf8');

  for (const line of contents.split('\n')) {
    const trimmed = line.trim();

    if (trimmed.length === 0 || _.startsWith(trimmed, '#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    const key = trimmed.slice(0, separatorIndex);
    const value = trimmed.slice(separatorIndex + 1);

    process.env[key] = value;
  }
}

export function readRequiredEnv(key: string): string {
  const value = process.env[key];

  if (value) {
    return value;
  }

  throw new Error(`readRequiredEnv() missing ${key}`);
}

export function readDatabaseName(databaseUrl: string): string {
  const name = new URL(databaseUrl).pathname.slice(1);

  if (DATABASE_NAME_PATTERN.test(name)) {
    return name;
  }

  throw new Error(`readDatabaseName() refusing unsafe database name ${name}`);
}

export function resolveTestDatabaseUrl(databaseUrl: string, suiteName: string): string {
  const url = new URL(databaseUrl);
  const name = readDatabaseName(databaseUrl);
  const databaseSuffix = `_${suiteName}_test`;

  if (_.endsWith(name, databaseSuffix)) {
    return url.toString();
  }

  url.pathname = `/${name}${databaseSuffix}`;

  return url.toString();
}

export function resolveAdminDatabaseUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl);

  url.pathname = '/postgres';

  return url.toString();
}

export function loadTestEnv(): void {
  readEnvFile();

  const suiteName = readRequiredEnv('TEST_SUITE_NAME');

  process.env.DATABASE_URL = resolveTestDatabaseUrl(readRequiredEnv('DATABASE_URL'), suiteName);
  process.env.REDIS_KEY_PREFIX = `pinstripe_${suiteName}_test`;
  process.env.NODE_ENV = TEST_NODE_ENV;
  process.env.LOG_LEVEL = TEST_LOG_LEVEL;
  process.env.TEST_CLOCKS_ENABLED = 'true';
}
