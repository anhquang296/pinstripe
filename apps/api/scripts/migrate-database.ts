import { billingMigrationSource } from '@vxrerp/billing/database';
import { loadEnv } from '@vxrerp/platform/config';
import { migrateDatabase, platformMigrationSource } from '@vxrerp/platform/database';

async function main(): Promise<void> {
  const env = loadEnv(process.env);

  await migrateDatabase(env.DATABASE_URL, [platformMigrationSource, billingMigrationSource]);
}

main().catch((error: unknown) => {
  process.stderr.write(`main() migration failed: ${String(error)}\n`);
  process.exit(1);
});
