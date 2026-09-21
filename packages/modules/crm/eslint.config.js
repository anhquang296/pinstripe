import { node } from '@vxrerp/eslint-config/node';

export default node({
  tsconfigRootDir: import.meta.dirname,
  ignores: ['migrations/'],
  hasLodash: false,
  importBans: [
    {
      group: ['@vxrerp/billing', '@vxrerp/billing/*'],
      message:
        'erp-module-convention: a module never imports another module — react to its domain events instead.',
    },
  ],
});
