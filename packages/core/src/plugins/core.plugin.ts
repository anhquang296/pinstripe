import { configPlugin } from '@plugins/config.plugin';
import { databasePlugin } from '@plugins/database.plugin';
import { pspPlugin } from '@plugins/psp.plugin';
import { queuePlugin } from '@plugins/queue.plugin';
import { redisPlugin } from '@plugins/redis.plugin';
import { repositoryRegistryPlugin } from '@plugins/repository-registry.plugin';
import { serviceRegistryPlugin } from '@plugins/service-registry.plugin';
import fp from 'fastify-plugin';

export const corePlugin = fp(async (fastify) => {
  await fastify.register(configPlugin);
  await fastify.register(databasePlugin);
  await fastify.register(redisPlugin);
  await fastify.register(queuePlugin);
  await fastify.register(pspPlugin);
  await fastify.register(repositoryRegistryPlugin);
  await fastify.register(serviceRegistryPlugin);
});
