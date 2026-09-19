import { RELATIVE_PARENT_IMPORTS } from '@pinstripe/eslint-config/agentkit';
import { react } from '@pinstripe/eslint-config/react';

const BETTER_AUTH_IMPORTS = {
  group: ['better-auth', 'better-auth/*', 'better-auth/**'],
  message:
    'auth-convention: better-auth is imported in src/libs/auth-client.ts and nowhere else — every other call goes through @pinstripe/sdk.',
};

const REACT_ARIA_IMPORTS = {
  group: [
    'react-aria',
    'react-aria/*',
    'react-aria-components',
    'react-aria-components/*',
    '@react-aria/*',
    '@react-stately/*',
  ],
  message:
    'admin-ui-convention: react-aria is a peer of @heroui/react, not an import of admin-ui — use @heroui/react, and build tables through DataTable (TanStack Table).',
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
        {
          patterns: [...RELATIVE_PARENT_IMPORTS.patterns, BETTER_AUTH_IMPORTS, REACT_ARIA_IMPORTS],
        },
      ],
    },
  },
  {
    files: ['src/libs/auth-client.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [...RELATIVE_PARENT_IMPORTS.patterns, REACT_ARIA_IMPORTS] },
      ],
    },
  },
];
