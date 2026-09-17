import { corePlugin } from '@plugins/core.plugin';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';

import { truncateDatabase } from './truncate';

export async function buildTestContext(): Promise<FastifyInstance> {
  const fastify = Fastify({ logger: false });

  await fastify.register(corePlugin);
  await truncateDatabase(fastify.database);

  return fastify;
}
