import { corePlugin, workerConnectionPlugin } from '@pinstripe/core/plugins';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';

const HEALTHY_STATUS_CODE = 200;
const DRAINING_STATUS_CODE = 503;

export async function buildContext(): Promise<FastifyInstance> {
  const fastify = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });
  let isDraining = false;

  await fastify.register(corePlugin);
  await fastify.register(workerConnectionPlugin);

  fastify.decorate('startDraining', () => {
    isDraining = true;
  });

  fastify.get('/healthz', async (_request, reply) => {
    const statusCode = isDraining ? DRAINING_STATUS_CODE : HEALTHY_STATUS_CODE;

    return reply.code(statusCode).send({ status: isDraining ? 'draining' : 'ok' });
  });

  return fastify;
}
