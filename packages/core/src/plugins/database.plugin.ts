import fp from 'fastify-plugin';
import { DatabaseClient } from '@database/database.client';

export const databasePlugin = fp(async (fastify) => {
  const { DATABASE_URL, DATABASE_POOL_MAX } = fastify.config;

  const database = new DatabaseClient(
    { url: DATABASE_URL, poolMax: DATABASE_POOL_MAX },
    fastify.log,
  );

  await database.connect();

  fastify.decorate('database', database);
  fastify.addHook('onClose', async () => {
    await database.close();
  });
});
