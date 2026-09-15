import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { corePlugin } from '@plugins/core.plugin';

export async function buildTestContext(): Promise<FastifyInstance> {
  const fastify = Fastify({ logger: false });

  await fastify.register(corePlugin);

  return fastify;
}
