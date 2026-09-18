import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: false,
    include: ['tests/**/*.integration.test.ts'],
    globalSetup: ['../../packages/core/tests/global-setup.ts'],
    setupFiles: ['../../packages/core/tests/setup.ts'],
    env: { TEST_SUITE_NAME: 'api' },
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
