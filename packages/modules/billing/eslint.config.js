import { node } from '@vxrerp/eslint-config/node';

export default node({
  tsconfigRootDir: import.meta.dirname,
  ignores: ['migrations/'],
  importBans: [
    {
      group: ['@vxrerp/crm', '@vxrerp/crm/*'],
      message:
        'erp-module-convention: a module never imports another module — react to its domain events instead.',
    },
  ],
});
