import fp from 'fastify-plugin';
import { Redis } from 'ioredis';

export const redisPlugin = fp(async (fastify) => {
  const { REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_KEY_PREFIX } = fastify.config;

  const redis = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    password: REDIS_PASSWORD,
    keyPrefix: `${REDIS_KEY_PREFIX}:`,
    maxRetriesPerRequest: null,
  });

  fastify.decorate('redis', redis);
  fastify.addHook('onClose', async () => {
    await redis.quit();
  });
});
