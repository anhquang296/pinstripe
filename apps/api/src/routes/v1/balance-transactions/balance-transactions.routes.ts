import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  balanceTransactionParamsSchema,
  balanceTransactionSchema,
  findBalanceTransactionsSchema,
  ListResponseSchema,
} from '@pinstripe/core/contracts';
import { ApiResponse } from '@utils/api-response';
import { readLivemode } from '@utils/request-auth';

export const balanceTransactionsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    '/',
    {
      schema: {
        querystring: findBalanceTransactionsSchema,
        response: { 200: ListResponseSchema(balanceTransactionSchema) },
      },
    },
    async (request, reply) => {
      const balanceTransactions = await fastify.balanceService.findBalanceTransactions(
        request.query,
        readLivemode(request),
      );

      return ApiResponse.success(reply, balanceTransactions);
    },
  );

  fastify.get(
    '/:balanceTransactionId',
    {
      schema: {
        params: balanceTransactionParamsSchema,
        response: { 200: balanceTransactionSchema },
      },
    },
    async (request, reply) => {
      const balanceTransaction = await fastify.balanceService.getBalanceTransaction(
        request.params.balanceTransactionId,
        readLivemode(request),
      );

      return ApiResponse.success(reply, balanceTransaction);
    },
  );
};
