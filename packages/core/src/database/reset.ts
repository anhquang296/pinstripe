import type { Env } from '@config/env.schema';
import { loadEnv, NodeEnvEnum } from '@config/env.schema';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { Redis } from 'ioredis';
import postgres from 'postgres';

async function resetDatabase(env: Env): Promise<void> {
  const sql = postgres(env.DATABASE_URL, { max: 1, onnotice: () => {} });

  await sql.unsafe('DROP SCHEMA IF EXISTS public CASCADE');
  await sql.unsafe('DROP SCHEMA IF EXISTS drizzle CASCADE');
  await sql.unsafe('CREATE SCHEMA public');

  await migrate(drizzle(sql), { migrationsFolder: 'migrations' });
  await sql.end();
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
