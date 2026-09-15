import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { corePlugin } from '@pinstripe/core/plugins';

export async function buildContext(): Promise<FastifyInstance> {
  const fastify = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });

  await fastify.register(corePlugin);

  fastify.get('/healthz', async () => {
    return { status: 'ok' };
  });

  return fastify;
}
