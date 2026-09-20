import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PinstripeClient } from '@client/pinstripe.client';
import { expect, it } from 'vitest';

const REACT_DIRECTORY = dirname(fileURLToPath(import.meta.url));

const UNCOVERED_METHODS: string[] = [];

function collectResourceMethods(owner: object, prefix: string): string[] {
  const methods: string[] = [];

  for (const [name, value] of Object.entries(owner)) {
    if (name.startsWith('_') || typeof value !== 'object' || value === null) {
      continue;
    }

    const path = prefix ? `${prefix}.${name}` : name;

    const ownMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(value)).filter((member) => {
      return member !== 'constructor';
    });

    for (const member of ownMethods) {
      methods.push(`${path}.${member}`);
    }

    methods.push(...collectResourceMethods(value, path));
  }

  return methods;
}

function readHookSources(): string {
  const sources: string[] = [];

  const walk = (directory: string) => {
    for (const entry of readdirSync(directory)) {
      const entryPath = join(directory, entry);

      if (statSync(entryPath).isDirectory()) {
        walk(entryPath);

        continue;
      }

      if (entryPath.endsWith('.ts') && !entryPath.endsWith('.test.ts')) {
        sources.push(readFileSync(entryPath, 'utf8'));
      }
    }
  };

  walk(REACT_DIRECTORY);

  return sources.join('\n');
}

it('exposes every resource method through at least one hook', () => {
  const client = new PinstripeClient();
  const methods = collectResourceMethods(client, '');
  const reactSources = readHookSources();

  const uncalled = methods.filter((method) => {
    if (UNCOVERED_METHODS.includes(method)) {
      return false;
    }

    return !reactSources.includes(`client.${method}(`);
  });

  expect(uncalled).toEqual([]);
});

it('keeps the uncovered list to portal methods the admin dashboard does not own', () => {
  const client = new PinstripeClient();
  const methods = collectResourceMethods(client, '');

  expect(methods).toEqual(expect.arrayContaining(UNCOVERED_METHODS));
  expect(
    UNCOVERED_METHODS.every((method) => {
      return method.startsWith('portal.') && method !== 'portal.links.create';
    }),
  ).toBe(true);
});
