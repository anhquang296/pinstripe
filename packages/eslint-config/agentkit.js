const STEP_NAMED_LOCALS =
  '/^(created|updated|existing|found|result|record|row|item|data|values|obj|node)$/';

export const STEP_NAMED_LOCAL_SYNTAX = {
  selector: `VariableDeclarator[id.name=${STEP_NAMED_LOCALS}]`,
  message:
    'naming-convention §Locals: name the entity the binding holds, not the step that produced it — createdCustomer, existingIdempotencyKey, customerRows.',
};

export const AGENTKIT_RESTRICTED_SYNTAX = [
  {
    selector: "Property[key.name='err']",
    message:
      'logging-convention: a caught error goes under the key `error`, never `err` — { error }, not { err } or { err: error }.',
  },
  {
    selector: "CatchClause[param.name='err']",
    message: 'naming-convention: catch (error), never catch (err).',
  },
  STEP_NAMED_LOCAL_SYNTAX,
  {
    selector: 'MemberExpression[optional=true] > MemberExpression[optional=true]',
    message:
      'nested-access-convention: read a deep path once into a named local instead of writing an optional-chain ladder.',
  },
  {
    selector: "LogicalExpression[operator='??'][right.raw!='null'] > ChainExpression.left",
    message:
      'nested-access-convention §Depth is not the test: `?.` with `??` fuses a read to its fallback — read it once into a named local (or _.get where lodash ships). Only `?? null` at a boundary stays.',
  },
  {
    selector:
      "VariableDeclarator[id.type='ObjectPattern'] > LogicalExpression[operator='??'] > ObjectExpression.right[properties.length=0]",
    message:
      'nested-access-convention §Depth is not the test: `<container> ?? {}` so a destructure can reach through it invents an object to read a field off — guard the container instead.',
  },
  {
    selector: 'MethodDefinition[key.name=/By[A-Z]/]',
    message:
      'naming-convention: the lookup key lives in the parameter name, not the method name — findCustomer(id), never findCustomerById.',
  },
  {
    selector: 'MethodDefinition[key.name=/(OrThrow|OrNull|OrFail|Async)$/]',
    message:
      'naming-convention: no OrThrow / OrNull / OrFail / Async suffixes — get throws, find returns null, every method is async.',
  },
  {
    selector: 'MethodDefinition[key.name=/^(list|fetch|load|save|insert|purge|destroy)[A-Z]/]',
    message:
      'naming-convention §Verbs: use find / create / upsert / delete — list, fetch, load, save, insert, purge and destroy are not verbs of this codebase.',
  },
];

export const AGENTKIT_STYLE_RULES = {
  'arrow-body-style': ['error', 'always'],
  curly: ['error', 'all'],
  'no-restricted-syntax': ['error', ...AGENTKIT_RESTRICTED_SYNTAX],
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/no-non-null-assertion': 'error',
};

export const RELATIVE_PARENT_IMPORTS = {
  patterns: [
    {
      group: ['../*', '../../*', '../../../*'],
      message:
        'import-convention: a package that declares tsconfig paths never imports through `..` — use its alias.',
    },
  ],
};
