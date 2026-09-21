import fp from 'fastify-plugin';
import { Redis } from 'ioredis';

export const workerConnectionPlugin = fp(async (fastify) => {
  const { REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_KEY_PREFIX } = fastify.config;

  const connection = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    password: REDIS_PASSWORD,
    maxRetriesPerRequest: null,
  });

  fastify.decorate('workerConnection', connection);
  fastify.decorate('queuePrefix', `${REDIS_KEY_PREFIX}:bull`);
  fastify.addHook('onClose', async () => {
    await connection.quit();
  });
});
