import js from '@eslint/js';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import tseslint from 'typescript-eslint';

import {
  AGENTKIT_RESTRICTED_SYNTAX,
  AGENTKIT_STYLE_RULES,
  STEP_NAMED_LOCAL_SYNTAX,
} from './agentkit.js';

export function base({ ignores = [], tsconfigRootDir } = {}) {
  return [
    {
      ignores: [
        '**/dist/',
        '**/node_modules/',
        '**/coverage/',
        '**/migrations/',
        '*.config.js',
        '*.config.mjs',
        '*.config.ts',
        ...ignores,
      ],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    ...(tsconfigRootDir ? [{ languageOptions: { parserOptions: { tsconfigRootDir } } }] : []),
    {
      files: ['**/*.{ts,tsx}'],
      rules: {
        '@typescript-eslint/no-empty-object-type': 'off',
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        '@typescript-eslint/no-unused-vars': [
          'error',
          { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
        ],
      },
    },
    {
      plugins: { 'simple-import-sort': simpleImportSort },
      rules: {
        'simple-import-sort/imports': 'error',
        'simple-import-sort/exports': 'error',
      },
    },
    prettierRecommended,
    {
      files: ['**/*.{ts,tsx}'],
      rules: AGENTKIT_STYLE_RULES,
    },
    {
      files: ['**/*.test.ts', '**/*.test.tsx', '**/tests/**'],
      rules: {
        'no-restricted-syntax': [
          'error',
          ...AGENTKIT_RESTRICTED_SYNTAX.filter((entry) => {
            return entry !== STEP_NAMED_LOCAL_SYNTAX;
          }),
        ],
      },
    },
  ];
}
