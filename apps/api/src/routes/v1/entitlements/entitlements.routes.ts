import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  entitlementSchema,
  findEntitlementsSchema,
  ListResponseSchema,
} from '@pinstripe/core/contracts';
import { ApiResponse } from '@utils/api-response';
import { readLivemode } from '@utils/request-auth';

export const entitlementsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    '/',
    {
      schema: {
        querystring: findEntitlementsSchema,
        response: { 200: ListResponseSchema(entitlementSchema) },
      },
    },
    async (request, reply) => {
      const entitlements = await fastify.entitlementService.findEntitlements(
        request.query,
        readLivemode(request),
      );

      return ApiResponse.success(reply, entitlements);
    },
  );
};
