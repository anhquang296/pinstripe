import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { balanceSchema } from '@pinstripe/core/contracts';
import { ApiResponse } from '@utils/api-response';
import { readLivemode } from '@utils/request-auth';

export const balanceRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get('/', { schema: { response: { 200: balanceSchema } } }, async (request, reply) => {
    const balance = await fastify.balanceService.getBalance(readLivemode(request));

    return ApiResponse.success(reply, balance);
  });
};
