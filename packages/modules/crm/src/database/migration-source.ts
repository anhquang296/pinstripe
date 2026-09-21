import { buildMigrationSource } from '@vxrerp/platform/database';

export const crmMigrationSource = buildMigrationSource(
  import.meta.url,
  '@vxrerp/crm',
  '__crm_migrations',
);
