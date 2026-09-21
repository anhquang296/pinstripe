import { billingMigrationSource } from '@database/migration-source';
import { platformMigrationSource } from '@vxrerp/platform/database';
import { createTestDatabaseSetup } from '@vxrerp/platform/testing';

export const setup = createTestDatabaseSetup([platformMigrationSource, billingMigrationSource], {
  envOverrides: { TEST_CLOCKS_ENABLED: 'true' },
});
