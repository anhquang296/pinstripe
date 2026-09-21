import path from 'node:path';

const PACKAGE_ROOTS = [
  'packages/platform',
  'packages/modules/billing',
  'packages/sdk',
  'apps/api',
  'apps/worker',
  'apps/erp-ui',
  'apps/billing-portal-ui',
];

const GENERATED_PATHS = [
  '.claude/rules/agentkit/',
  '.agentkit/',
  'CLAUDE.md',
  'AGENTS.md',
  'pnpm-lock.yaml',
];

function toRepoRelative(file) {
  return path.relative(process.cwd(), file);
}

function isGenerated(file) {
  const relativePath = toRepoRelative(file);

  return GENERATED_PATHS.some((generated) => {
    return relativePath.startsWith(generated);
  });
}

function groupByPackage(files) {
  const groups = new Map();

  for (const file of files) {
    const relativePath = toRepoRelative(file);
    const packageRoot = PACKAGE_ROOTS.find((root) => {
      return relativePath.startsWith(`${root}/`);
    });

    if (packageRoot) {
      groups.set(packageRoot, [...(groups.get(packageRoot) ?? []), relativePath]);
    }
  }

  return groups;
}

export default {
  '*.{ts,tsx}': (files) => {
    const groups = groupByPackage(files);

    return [...groups.entries()].map(([packageRoot, packageFiles]) => {
      return `eslint --fix --config ${packageRoot}/eslint.config.js ${packageFiles.join(' ')}`;
    });
  },
  '*.{json,md,yaml,yml}': (files) => {
    const formattable = files.filter((file) => {
      return !isGenerated(file);
    });

    if (formattable.length === 0) {
      return [];
    }

    return [`prettier --write ${formattable.map(toRepoRelative).join(' ')}`];
  },
};
