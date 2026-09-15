import { corePlugin } from '@plugins/core.plugin';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';

export async function buildTestContext(): Promise<FastifyInstance> {
  const fastify = Fastify({ logger: false });

  await fastify.register(corePlugin);

  return fastify;
}
