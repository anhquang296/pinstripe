import { RELATIVE_PARENT_IMPORTS } from '@pinstripe/eslint-config/agentkit';
import { react } from '@pinstripe/eslint-config/react';

const BETTER_AUTH_IMPORTS = {
  group: ['better-auth', 'better-auth/*', 'better-auth/**'],
  message:
    'auth-convention: better-auth is imported in src/lib/auth-client.ts and nowhere else — every other call goes through @pinstripe/sdk.',
};

export default [
  ...react({
    tsconfigRootDir: import.meta.dirname,
    hasLodash: true,
  }),
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [...RELATIVE_PARENT_IMPORTS.patterns, BETTER_AUTH_IMPORTS] },
      ],
    },
  },
  {
    files: ['src/lib/auth-client.ts'],
    rules: {
      'no-restricted-imports': ['error', RELATIVE_PARENT_IMPORTS],
    },
  },
];
