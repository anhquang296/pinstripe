import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ENV_FILE = resolve(import.meta.dirname, '../../../.env');

for (const line of readFileSync(ENV_FILE, 'utf8').split('\n')) {
  const trimmed = line.trim();

  if (trimmed.length === 0 || trimmed.startsWith('#')) {
    continue;
  }

  const separatorIndex = trimmed.indexOf('=');
  const key = trimmed.slice(0, separatorIndex);
  const value = trimmed.slice(separatorIndex + 1);

  process.env[key] = value;
}
