import lodashPlugin from 'eslint-plugin-lodash';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

import { RELATIVE_PARENT_IMPORTS } from './agentkit.js';
import { base } from './base.js';

export function react({ ignores = [], tsconfigRootDir, hasLodash = false } = {}) {
  return [
    ...base({ ignores, tsconfigRootDir }),
    {
      languageOptions: {
        globals: { ...globals.browser },
      },
    },
    {
      files: ['**/*.{ts,tsx}'],
      ...reactPlugin.configs.flat.recommended,
    },
    {
      files: ['**/*.{ts,tsx}'],
      ...reactPlugin.configs.flat['jsx-runtime'],
    },
    {
      files: ['**/*.{ts,tsx}'],
      ...reactHooks.configs.flat.recommended,
    },
    {
      files: ['**/*.{ts,tsx}'],
      settings: { react: { version: 'detect' } },
      rules: {
        'no-restricted-imports': ['error', RELATIVE_PARENT_IMPORTS],
        'react/prop-types': 'off',
        'react/no-unescaped-entities': 'off',
        'no-console': ['warn', { allow: ['warn', 'error'] }],
        'no-debugger': 'error',
        'prefer-const': 'error',
        'no-var': 'error',
      },
    },
    ...(hasLodash
      ? [
          {
            files: ['src/**/*.{ts,tsx}'],
            plugins: { lodash: lodashPlugin },
            settings: { lodash: { version: 4, pragma: false } },
            rules: {
              'lodash/import-scope': ['error', 'member'],
              'lodash/prefer-lodash-method': [
                'error',
                {
                  ignoreMethods: ['reduceRight', 'push', 'join', 'split', 'replace', 'trim'],
                  ignoreObjects: [
                    'Object',
                    'JSON',
                    'Math',
                    'Promise',
                    'Array',
                    'String',
                    'Number',
                    '^vxrErp\\.',
                  ],
                },
              ],
              'lodash/prefer-get': 'error',
              'lodash/prefer-is-nil': 'error',
              'lodash/prefer-includes': 'error',
              'lodash/prefer-matches': 'error',
            },
          },
        ]
      : []),
  ];
}
