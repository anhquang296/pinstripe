import fp from 'fastify-plugin';
import { loadEnv } from '@config/env.schema';
import { SystemClock } from '@utils/clock';
import { RedisKeyFactory } from '@utils/redis-key-factory';

export const configPlugin = fp(async (fastify) => {
  const config = loadEnv(process.env);

  fastify.decorate('config', config);
  fastify.decorate('clock', new SystemClock());
  fastify.decorate('redisKeyFactory', new RedisKeyFactory(config.REDIS_KEY_PREFIX));
});
