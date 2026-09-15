import lodashPlugin from 'eslint-plugin-lodash';
import globals from 'globals';

import { RELATIVE_PARENT_IMPORTS } from './agentkit.js';
import { base } from './base.js';

const DATABASE_IMPORT_MESSAGE =
  'drizzle/query-convention: only repositories and plugins may import Drizzle tables — query through a repository.';

export function node({ ignores = [], tsconfigRootDir, hasLodash = true } = {}) {
  return [
    ...base({ ignores, tsconfigRootDir }),
    {
      languageOptions: {
        globals: { ...globals.node },
      },
    },
    {
      files: ['**/*.ts'],
      rules: {
        'no-restricted-imports': ['error', RELATIVE_PARENT_IMPORTS],
      },
    },
    {
      files: ['src/**/*.ts'],
      ignores: ['src/repositories/**', 'src/database/**', 'src/plugins/**'],
      rules: {
        'no-restricted-imports': 'off',
        '@typescript-eslint/no-restricted-imports': [
          'error',
          {
            patterns: [
              ...RELATIVE_PARENT_IMPORTS.patterns,
              {
                group: ['@database/schemas*'],
                allowTypeImports: true,
                message: DATABASE_IMPORT_MESSAGE,
              },
            ],
          },
        ],
      },
    },
    ...(hasLodash
      ? [
          {
            files: ['src/**/*.ts'],
            plugins: { lodash: lodashPlugin },
            settings: { lodash: { version: 4 } },
            rules: {
              'lodash/prefer-lodash-method': [
                'error',
                {
                  ignoreMethods: ['reduceRight', 'push', 'join', 'split', 'replace', 'trim'],
                  ignoreObjects: ['Object', 'JSON', 'Math', 'Promise', 'Array', 'String', 'Number'],
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
