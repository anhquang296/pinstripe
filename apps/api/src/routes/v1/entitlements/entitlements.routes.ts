import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  entitlementSchema,
  findEntitlementsSchema,
  ListResponseSchema,
} from '@pinstripe/core/contracts';
import { ApiResponse } from '@utils/api-response';

export const entitlementsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    '/',
    {
      schema: {
        operationId: 'entitlements.find',
        querystring: findEntitlementsSchema,
        response: { 200: ListResponseSchema(entitlementSchema) },
      },
    },
    async (request, reply) => {
      const entitlements = await fastify.entitlementService.findEntitlements(request.query);

      return ApiResponse.success(reply, entitlements);
    },
  );
};
