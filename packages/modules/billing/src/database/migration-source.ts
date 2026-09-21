import { buildMigrationSource } from '@vxrerp/platform/database';

export const billingMigrationSource = buildMigrationSource(
  import.meta.url,
  '@vxrerp/billing',
  '__billing_migrations',
);
