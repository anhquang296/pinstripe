import { billingMigrationSource } from '@vxrerp/billing/database';
import { crmMigrationSource } from '@vxrerp/crm/database';
import type { Env } from '@vxrerp/platform/config';
import { loadEnv, NodeEnvEnum } from '@vxrerp/platform/config';
import {
  dropDatabaseSchemas,
  migrateDatabase,
  platformMigrationSource,
} from '@vxrerp/platform/database';
import { Redis } from 'ioredis';

async function resetDatabase(env: Env): Promise<void> {
  await dropDatabaseSchemas(env.DATABASE_URL);
  await migrateDatabase(env.DATABASE_URL, [
    platformMigrationSource,
    billingMigrationSource,
    crmMigrationSource,
  ]);
}

async function resetRedis(env: Env): Promise<number> {
  const SCAN_BATCH_SIZE = 1000;

  const redis = new Redis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
  });

  const stream = redis.scanStream({ match: `${env.REDIS_KEY_PREFIX}:*`, count: SCAN_BATCH_SIZE });

  let deletedCount = 0;

  for await (const keys of stream) {
    if (keys.length > 0) {
      await redis.unlink(...(keys as string[]));

      deletedCount += keys.length;
    }
  }

  await redis.quit();

  return deletedCount;
}

async function main(): Promise<void> {
  const env = loadEnv(process.env);

  if (env.NODE_ENV === NodeEnvEnum.PRODUCTION) {
    throw new Error('main() refusing to reset a production environment');
  }

  const { host } = new URL(env.DATABASE_URL);

  process.stdout.write(
    `main() resetting postgres at ${host} and redis keys ${env.REDIS_KEY_PREFIX}:*\n`,
  );

  await resetDatabase(env);

  const deletedCount = await resetRedis(env);

  process.stdout.write(
    `main() completed, schema recreated and ${deletedCount} redis keys removed\n`,
  );
}

main().catch((error: unknown) => {
  process.stderr.write(`main() reset failed: ${String(error)}\n`);
  process.exit(1);
});
