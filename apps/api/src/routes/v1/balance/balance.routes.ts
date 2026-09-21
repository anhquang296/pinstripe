import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { ApiResponse } from '@utils/api-response';
import { balanceSchema } from '@vxrerp/core/contracts';

export const balanceRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    '/',
    { schema: { operationId: 'balance.get', response: { 200: balanceSchema } } },
    async (_request, reply) => {
      const balance = await fastify.balanceService.getBalance();

      return ApiResponse.success(reply, balance);
    },
  );
};
