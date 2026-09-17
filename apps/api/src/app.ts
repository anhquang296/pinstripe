import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { corePlugin } from '@pinstripe/core/plugins';
import { apiKeyPlugin } from '@plugins/api-key.plugin';
import { apiVersionPlugin } from '@plugins/api-version.plugin';
import { errorHandlerPlugin } from '@plugins/error-handler.plugin';
import { apiRoutes } from '@routes/routes';
import { parseQuerystring } from '@utils/querystring';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';

export async function buildApp(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? 'info' },
    genReqId: () => {
      return `req_${Math.random().toString(36).slice(2, 14)}`;
    },
    ajv: { customOptions: { removeAdditional: false } },
    querystringParser: parseQuerystring,
  }).withTypeProvider<TypeBoxTypeProvider>();

  await fastify.register(corePlugin);
  await fastify.register(apiKeyPlugin);
  await fastify.register(apiVersionPlugin);

  await fastify.register(errorHandlerPlugin);
  await fastify.register(apiRoutes);

  return fastify;
}
