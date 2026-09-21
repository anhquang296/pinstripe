import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { ApiResponse } from '@utils/api-response';
import { entitlementSchema, findEntitlementsSchema } from '@vxrerp/billing/contracts';
import { ListResponseSchema } from '@vxrerp/platform/contracts';

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
