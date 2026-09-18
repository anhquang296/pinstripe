import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { compact, flatMap, isEmpty, map, some } from 'lodash-es';
import { describe, expect, it } from 'vitest';

const PAGES_DIR = dirname(fileURLToPath(import.meta.url));
const SDK_REACT_DIR = resolve(PAGES_DIR, '../../../../packages/sdk/src/react');

const DOMAINS = [
  'customers',
  'products',
  'prices',
  'subscriptions',
  'entitlements',
  'meters',
  'discounts',
  'tax',
  'payment-links',
  'checkout',
  'billing-portal',
];

const HOOK_DECLARATION = /export function (use[A-Za-z0-9]+)/g;

function findSourceFiles(directory: string): string[] {
  return flatMap(readdirSync(directory), (entry) => {
    const entryPath = join(directory, entry);

    if (statSync(entryPath).isDirectory()) {
      return findSourceFiles(entryPath);
    }

    return [entryPath];
  });
}

function findDomainHooks(domain: string): string[] {
  const sourcePaths = map(['queries.ts', 'mutations.ts'], (fileName) => {
    return join(SDK_REACT_DIR, domain, fileName);
  });

  return flatMap(sourcePaths, (sourcePath) => {
    if (!existsSync(sourcePath)) {
      return [];
    }

    const source = readFileSync(sourcePath, 'utf8');

    return compact(
      map([...source.matchAll(HOOK_DECLARATION)], (match) => {
        return match[1];
      }),
    );
  });
}

const sdkIndex = readFileSync(join(SDK_REACT_DIR, 'index.ts'), 'utf8');
const pageSources = map(findSourceFiles(PAGES_DIR), (pagePath) => {
  return readFileSync(pagePath, 'utf8');
});

describe.each(DOMAINS)('hook của domain %s', (domain) => {
  const hookNames = findDomainHooks(domain);

  it('có ít nhất một hook được export từ @pinstripe/sdk/react', () => {
    expect(isEmpty(hookNames)).toBe(false);

    for (const hookName of hookNames) {
      expect(sdkIndex).toContain(hookName);
    }
  });

  it.each(hookNames)('%s được dùng trong ít nhất một file dưới src/pages', (hookName) => {
    const isUsed = some(pageSources, (pageSource) => {
      return new RegExp(`\\b${hookName}\\b`).test(pageSource);
    });

    expect(isUsed).toBe(true);
  });
});
