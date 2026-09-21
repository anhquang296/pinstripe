import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { ApiResponse } from '@utils/api-response';
import {
  apiKeyParamsSchema,
  apiKeySchema,
  createApiKeySchema,
  findApiKeysSchema,
  ListResponseSchema,
} from '@vxrerp/core/contracts';

export const apiKeysRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    '/',
    {
      schema: {
        operationId: 'apiKeys.create',
        body: createApiKeySchema,
        response: { 201: apiKeySchema },
      },
    },
    async (request, reply) => {
      const apiKey = await fastify.apiKeyService.createApiKey(request.body);

      return ApiResponse.created(reply, apiKey);
    },
  );

  fastify.get(
    '/',
    {
      schema: {
        operationId: 'apiKeys.find',
        querystring: findApiKeysSchema,
        response: { 200: ListResponseSchema(apiKeySchema) },
      },
    },
    async (request, reply) => {
      const apiKeys = await fastify.apiKeyService.findApiKeys(request.query);

      return ApiResponse.success(reply, apiKeys);
    },
  );

  fastify.delete(
    '/:apiKeyId',
    {
      schema: {
        operationId: 'apiKeys.delete',
        params: apiKeyParamsSchema,
        response: { 200: apiKeySchema },
      },
    },
    async (request, reply) => {
      const apiKey = await fastify.apiKeyService.revokeApiKey(request.params.apiKeyId);

      return ApiResponse.success(reply, apiKey);
    },
  );
};
