import { platformMigrationSource } from '@database/migration-source';
import { createTestDatabaseSetup } from '@testing/test-database';

export const setup = createTestDatabaseSetup([platformMigrationSource]);
