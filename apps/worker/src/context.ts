import { corePlugin, workerConnectionPlugin } from '@pinstripe/core/plugins';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';

const HEALTHY_STATUS_CODE = 200;
const DRAINING_STATUS_CODE = 503;

export async function buildContext(): Promise<FastifyInstance> {
  const { LOG_LEVEL = 'info' } = process.env;

  const fastify = Fastify({ logger: { level: LOG_LEVEL } });
  let isDraining = false;

  await fastify.register(corePlugin);
  await fastify.register(workerConnectionPlugin);

  fastify.decorate('startDraining', () => {
    isDraining = true;
  });

  fastify.get('/healthz', async (_request, reply) => {
    const statusCode = isDraining ? DRAINING_STATUS_CODE : HEALTHY_STATUS_CODE;
    const status = isDraining ? 'draining' : 'ok';

    return reply.code(statusCode).send({ status });
  });

  return fastify;
}
