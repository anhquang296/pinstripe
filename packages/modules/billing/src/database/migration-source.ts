import { buildMigrationSource } from '@vxrerp/platform/database';

export const billingMigrationSource = buildMigrationSource(
  '@vxrerp/billing',
  '__billing_migrations',
);
