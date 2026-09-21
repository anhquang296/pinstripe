import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, it } from 'vitest';

const DIST_INDEX_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../dist/index.js');

function readIsomorphicBundle(): string | null {
  try {
    return readFileSync(DIST_INDEX_PATH, 'utf8');
  } catch {
    return null;
  }
}

it('keeps the isomorphic entry free of node builtins and of a runtime core import', () => {
  const bundle = readIsomorphicBundle();

  if (!bundle) {
    expect.fail('dist/index.js is missing — run `pnpm --filter @vxrerp/sdk build` first');
  }

  expect(bundle).not.toContain('node:');
  expect(bundle).not.toContain('@vxrerp/core');
});
