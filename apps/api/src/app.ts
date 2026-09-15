import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { corePlugin } from '@pinstripe/core/plugins';
import { apiKeyPlugin } from '@plugins/api-key.plugin';
import { registerRoutes } from '@routes/routes';
import { registerErrorHandler } from '@utils/error-handler';

export async function buildApp(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? 'info' },
    genReqId: () => `req_${Math.random().toString(36).slice(2, 14)}`,
  }).withTypeProvider<TypeBoxTypeProvider>();

  await fastify.register(corePlugin);
  await fastify.register(apiKeyPlugin);

  registerErrorHandler(fastify);

  await fastify.register(registerRoutes);

  return fastify;
}
