import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { ApiResponse } from '@utils/api-response';
import {
  balanceTransactionParamsSchema,
  balanceTransactionSchema,
  findBalanceTransactionsSchema,
  ListResponseSchema,
} from '@vxrerp/core/contracts';

export const balanceTransactionsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    '/',
    {
      schema: {
        operationId: 'balanceTransactions.find',
        querystring: findBalanceTransactionsSchema,
        response: { 200: ListResponseSchema(balanceTransactionSchema) },
      },
    },
    async (request, reply) => {
      const balanceTransactions = await fastify.balanceService.findBalanceTransactions(
        request.query,
      );

      return ApiResponse.success(reply, balanceTransactions);
    },
  );

  fastify.get(
    '/:balanceTransactionId',
    {
      schema: {
        operationId: 'balanceTransactions.get',
        params: balanceTransactionParamsSchema,
        response: { 200: balanceTransactionSchema },
      },
    },
    async (request, reply) => {
      const balanceTransaction = await fastify.balanceService.getBalanceTransaction(
        request.params.balanceTransactionId,
      );

      return ApiResponse.success(reply, balanceTransaction);
    },
  );
};
