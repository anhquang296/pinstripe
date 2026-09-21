import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { compact, endsWith, filter, flatMap, isEmpty, map, some, uniq } from 'lodash-es';
import { describe, expect, it } from 'vitest';

const SOURCE_DIR = dirname(fileURLToPath(import.meta.url));
const SDK_PORTAL_INDEX = resolve(SOURCE_DIR, '../../../packages/sdk/src/react/portal/index.ts');

const EXPORTED_HOOK = /\buse[A-Za-z0-9]+(Query|Mutation)\b/g;

function findSourceFiles(directory: string): string[] {
  return flatMap(readdirSync(directory), (entry) => {
    const entryPath = join(directory, entry);

    if (statSync(entryPath).isDirectory()) {
      return findSourceFiles(entryPath);
    }

    if (endsWith(entryPath, '.test.ts') || endsWith(entryPath, '.test.tsx')) {
      return [];
    }

    return [entryPath];
  });
}

const sdkPortalIndex = readFileSync(SDK_PORTAL_INDEX, 'utf8');

const hookNames = uniq(
  compact(
    map([...sdkPortalIndex.matchAll(EXPORTED_HOOK)], (match) => {
      return match[0];
    }),
  ),
);

const appSources = map(findSourceFiles(SOURCE_DIR), (sourcePath) => {
  return readFileSync(sourcePath, 'utf8');
});

describe('hook của @vxrerp/sdk/react/portal', () => {
  it('đọc được danh sách hook từ barrel portal của SDK', () => {
    expect(isEmpty(hookNames)).toBe(false);
  });

  it('không còn hook portal nào mà billing-portal-ui chưa dùng', () => {
    const unusedHooks = filter(hookNames, (hookName) => {
      return !some(appSources, (appSource) => {
        return new RegExp(`\\b${hookName}\\b`).test(appSource);
      });
    });

    expect(unusedHooks).toEqual([]);
  });
});
