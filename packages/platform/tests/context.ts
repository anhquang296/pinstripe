import { platformPlugin } from '@plugins/platform.plugin';
import { truncateDatabase } from '@testing/test-database';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';

export async function buildTestContext(): Promise<FastifyInstance> {
  const fastify = Fastify({ logger: false });

  await fastify.register(platformPlugin);
  await truncateDatabase(fastify.database);

  return fastify;
}
