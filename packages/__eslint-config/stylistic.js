import stylistic from '@stylistic/eslint-plugin';

const DESTRUCTURING_DECLARATION = {
  selector: 'VariableDeclaration[declarations.0.id.type=/^(ObjectPattern|ArrayPattern)$/]',
};

const MULTILINE_DECLARATIONS = [
  'multiline-const',
  'multiline-let',
  'multiline-var',
  'multiline-type',
];

const PADDING_LINE_RULES = [
  { blankLine: 'always', prev: 'directive', next: '*' },
  { blankLine: 'any', prev: 'directive', next: 'directive' },

  { blankLine: 'always', prev: 'import', next: '*' },
  { blankLine: 'any', prev: 'import', next: 'import' },

  { blankLine: 'always', prev: '*', next: 'return' },
  { blankLine: 'always', prev: '*', next: 'throw' },
  { blankLine: 'always', prev: '*', next: 'if' },
  { blankLine: 'always', prev: '*', next: ['for', 'while', 'do', 'switch', 'try'] },

  { blankLine: 'always', prev: ['const', 'let'], next: '*' },
  { blankLine: 'any', prev: ['const', 'let'], next: ['const', 'let'] },

  { blankLine: 'always', prev: 'block-like', next: '*' },
  { blankLine: 'always', prev: '*', next: 'block-like' },

  { blankLine: 'always', prev: MULTILINE_DECLARATIONS, next: '*' },
  { blankLine: 'always', prev: '*', next: MULTILINE_DECLARATIONS },

  { blankLine: 'always', prev: DESTRUCTURING_DECLARATION, next: '*' },
  { blankLine: 'always', prev: '*', next: DESTRUCTURING_DECLARATION },
];

export const STYLISTIC_RULES = {
  '@stylistic/padding-line-between-statements': ['error', ...PADDING_LINE_RULES],
  '@stylistic/lines-between-class-members': ['error', 'always', { exceptAfterSingleLine: true }],
};

export const stylisticPlugin = stylistic;
