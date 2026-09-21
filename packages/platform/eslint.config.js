import { node } from '@vxrerp/eslint-config/node';

export default node({
  tsconfigRootDir: import.meta.dirname,
  ignores: ['migrations/'],
  importBans: [
    {
      group: ['@vxrerp/billing', '@vxrerp/billing/*'],
      message:
        'erp-module-convention: platform never imports a module — a module depends on platform, never the reverse.',
    },
  ],
});
