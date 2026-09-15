import fp from 'fastify-plugin';
import { Redis } from 'ioredis';
import { QueueRegistry } from '@queues/queue-registry';

export const queuePlugin = fp(async (fastify) => {
  const { REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_KEY_PREFIX } = fastify.config;

  const connection = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    password: REDIS_PASSWORD,
    maxRetriesPerRequest: null,
  });

  const queues = new QueueRegistry(connection, `${REDIS_KEY_PREFIX}:bull`);

  fastify.decorate('queues', queues);
  fastify.addHook('onClose', async () => {
    await queues.close();
    await connection.quit();
  });
});
