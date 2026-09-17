import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

import { AGENTKIT_RESTRICTED_SYNTAX } from './agentkit.js';
import { node } from './node.js';

const STRIPE_SURFACE_VERB_SYNTAX =
  'MethodDefinition[key.name=/^(list|fetch|load|save|insert|purge|destroy)[A-Z]/]';

export function sdk({ ignores = [], tsconfigRootDir } = {}) {
  return [
    ...node({ ignores, tsconfigRootDir, hasLodash: false }),
    {
      files: ['src/resources/**/*.ts'],
      rules: {
        'no-restricted-syntax': [
          'error',
          ...AGENTKIT_RESTRICTED_SYNTAX.filter((entry) => {
            return entry.selector !== STRIPE_SURFACE_VERB_SYNTAX;
          }),
        ],
      },
    },
    {
      files: ['src/react/**/*.{ts,tsx}'],
      languageOptions: {
        globals: { ...globals.browser },
      },
    },
    {
      files: ['src/react/**/*.{ts,tsx}'],
      ...reactPlugin.configs.flat['jsx-runtime'],
    },
    {
      files: ['src/react/**/*.{ts,tsx}'],
      ...reactHooks.configs.flat.recommended,
    },
    {
      files: ['src/react/**/*.{ts,tsx}'],
      settings: { react: { version: 'detect' } },
      rules: {
        'react/prop-types': 'off',
      },
    },
  ];
}
