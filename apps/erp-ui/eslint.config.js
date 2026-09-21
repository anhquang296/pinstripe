import { RELATIVE_PARENT_IMPORTS } from '@vxrerp/eslint-config/agentkit';
import { react } from '@vxrerp/eslint-config/react';

const BETTER_AUTH_IMPORTS = {
  group: ['better-auth', 'better-auth/*', 'better-auth/**'],
  message:
    'auth-convention: better-auth is imported in src/libs/auth-client.ts and nowhere else — every other call goes through @vxrerp/sdk.',
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
    'erp-ui-convention: react-aria is a peer of @heroui/react, not an import of erp-ui — use @heroui/react, and build tables through DataTable (TanStack Table).',
};

const SHARED_PATTERNS = [...RELATIVE_PARENT_IMPORTS.patterns, BETTER_AUTH_IMPORTS, REACT_ARIA_IMPORTS];

const AUTH_IMPORTS = {
  group: ['@features/auth', '@features/auth/*'],
  message:
    'erp-ui-convention: features/auth composes the other features, never the reverse — a feature exposes a FeatureDefinition and does not import features/auth.',
};

const FEATURE_IMPORTS = {
  group: ['@features/*'],
  message:
    'erp-ui-convention: common/ knows no feature — move the piece into the feature that owns it.',
};

function crossFeatureImports(feature) {
  return {
    group: ['@features/*', `!@features/${feature}`, `!@features/${feature}/**`],
    message:
      'erp-ui-convention: a feature never imports another feature — only features/auth composes them.',
  };
}

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
          patterns: SHARED_PATTERNS,
        },
      ],
    },
  },
  {
    files: ['src/common/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [...SHARED_PATTERNS, FEATURE_IMPORTS] },
      ],
    },
  },
  ...['admin', 'billing'].map((feature) => {
    return {
      files: [`src/features/${feature}/**/*.{ts,tsx}`],
      rules: {
        'no-restricted-imports': [
          'error',
          { patterns: [...SHARED_PATTERNS, AUTH_IMPORTS, crossFeatureImports(feature)] },
        ],
      },
    };
  }),
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
