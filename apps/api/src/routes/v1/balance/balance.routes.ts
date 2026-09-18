import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { balanceSchema } from '@pinstripe/core/contracts';
import { ApiResponse } from '@utils/api-response';

export const balanceRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get('/', { schema: { response: { 200: balanceSchema } } }, async (_request, reply) => {
    const balance = await fastify.balanceService.getBalance();

    return ApiResponse.success(reply, balance);
  });
};
