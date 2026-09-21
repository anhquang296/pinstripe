import { betterAuthPlugin } from '@plugins/better-auth.plugin';
import { configPlugin } from '@plugins/config.plugin';
import { databasePlugin } from '@plugins/database.plugin';
import { fileStoragePlugin } from '@plugins/file-storage.plugin';
import { notificationPlugin } from '@plugins/notification.plugin';
import { queuePlugin } from '@plugins/queue.plugin';
import { redisPlugin } from '@plugins/redis.plugin';
import { repositoryRegistryPlugin } from '@plugins/repository-registry.plugin';
import { serviceRegistryPlugin } from '@plugins/service-registry.plugin';
import fp from 'fastify-plugin';

export const platformPlugin = fp(async (fastify) => {
  await fastify.register(configPlugin);
  await fastify.register(databasePlugin);
  await fastify.register(redisPlugin);
  await fastify.register(queuePlugin);
  await fastify.register(notificationPlugin);
  await fastify.register(fileStoragePlugin);
  await fastify.register(repositoryRegistryPlugin);
  await fastify.register(betterAuthPlugin);
  await fastify.register(serviceRegistryPlugin);
});
