import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

import { node } from './node.js';

export function sdk({ ignores = [], tsconfigRootDir } = {}) {
  return [
    ...node({ ignores, tsconfigRootDir, hasLodash: false }),
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
