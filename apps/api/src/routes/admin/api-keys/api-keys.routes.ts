import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  apiKeyParamsSchema,
  apiKeySchema,
  createApiKeySchema,
  findApiKeysSchema,
  ListResponseSchema,
  PermissionEnum,
} from '@pinstripe/core/contracts';
import { ApiResponse } from '@utils/api-response';
import { buildRouteConfig } from '@utils/route-permission';

export const apiKeysRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    '/',
    {
      config: buildRouteConfig(PermissionEnum.API_KEY_MANAGE),
      schema: { body: createApiKeySchema, response: { 201: apiKeySchema } },
    },
    async (request, reply) => {
      const apiKey = await fastify.apiKeyService.createApiKey(request.body);

      return ApiResponse.created(reply, apiKey);
    },
  );

  fastify.get(
    '/',
    {
      config: buildRouteConfig(PermissionEnum.API_KEY_MANAGE),
      schema: {
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
      config: buildRouteConfig(PermissionEnum.API_KEY_MANAGE),
      schema: { params: apiKeyParamsSchema, response: { 200: apiKeySchema } },
    },
    async (request, reply) => {
      const apiKey = await fastify.apiKeyService.revokeApiKey(request.params.apiKeyId);

      return ApiResponse.success(reply, apiKey);
    },
  );
};
