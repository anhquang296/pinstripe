import { loadEnv } from '@config/env.schema';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

async function main(): Promise<void> {
  const env = loadEnv(process.env);
  const sql = postgres(env.DATABASE_URL, { max: 1, onnotice: () => {} });

  await migrate(drizzle(sql), { migrationsFolder: 'migrations' });
  await sql.end();
}

main().catch((error: unknown) => {
  process.stderr.write(`main() migration failed: ${String(error)}\n`);
  process.exit(1);
});
