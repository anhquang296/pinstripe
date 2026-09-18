import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { corePlugin } from '@pinstripe/core/plugins';
import { apiKeyPlugin } from '@plugins/api-key.plugin';
import { apiVersionPlugin } from '@plugins/api-version.plugin';
import { errorHandlerPlugin } from '@plugins/error-handler.plugin';
import { swaggerPlugin } from '@plugins/swagger.plugin';
import { swaggerUiPlugin } from '@plugins/swagger-ui.plugin';
import { apiRoutes } from '@routes/routes';
import { parseQuerystring } from '@utils/querystring';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';

export async function buildApp(): Promise<FastifyInstance> {
  const { LOG_LEVEL = 'info' } = process.env;
  const fastify = Fastify({
    logger: { level: LOG_LEVEL },
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
  await fastify.register(swaggerPlugin);
  await fastify.register(swaggerUiPlugin);
  await fastify.register(apiRoutes);

  return fastify;
}
