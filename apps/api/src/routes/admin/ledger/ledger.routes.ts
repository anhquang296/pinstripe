import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  findLedgerAccountsSchema,
  findLedgerTransactionsSchema,
  ledgerAccountParamsSchema,
  ledgerAccountSchema,
  ledgerTransactionParamsSchema,
  ledgerTransactionSchema,
  ListResponseSchema,
  postLedgerTransactionSchema,
  reverseLedgerTransactionSchema,
} from '@pinstripe/core/contracts';
import { ApiResponse } from '@utils/api-response';
import { readLivemode } from '@utils/request-auth';

export const ledgerRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    '/accounts',
    {
      schema: {
        querystring: findLedgerAccountsSchema,
        response: { 200: ListResponseSchema(ledgerAccountSchema) },
      },
    },
    async (request, reply) => {
      const accounts = await fastify.ledgerService.findAccounts(
        request.query,
        readLivemode(request),
      );

      return ApiResponse.success(reply, accounts);
    },
  );

  fastify.get(
    '/accounts/:accountId',
    { schema: { params: ledgerAccountParamsSchema, response: { 200: ledgerAccountSchema } } },
    async (request, reply) => {
      const account = await fastify.ledgerService.getAccount(
        request.params.accountId,
        readLivemode(request),
      );

      return ApiResponse.success(reply, account);
    },
  );

  fastify.get(
    '/transactions',
    {
      schema: {
        querystring: findLedgerTransactionsSchema,
        response: { 200: ListResponseSchema(ledgerTransactionSchema) },
      },
    },
    async (request, reply) => {
      const transactions = await fastify.ledgerService.findTransactions(
        request.query,
        readLivemode(request),
      );

      return ApiResponse.success(reply, transactions);
    },
  );

  fastify.get(
    '/transactions/:transactionId',
    {
      schema: { params: ledgerTransactionParamsSchema, response: { 200: ledgerTransactionSchema } },
    },
    async (request, reply) => {
      const transaction = await fastify.ledgerService.getTransaction(
        request.params.transactionId,
        readLivemode(request),
      );

      return ApiResponse.success(reply, transaction);
    },
  );

  fastify.post(
    '/transactions',
    { schema: { body: postLedgerTransactionSchema, response: { 201: ledgerTransactionSchema } } },
    async (request, reply) => {
      const transaction = await fastify.ledgerService.postTransaction(
        request.body,
        readLivemode(request),
      );

      return ApiResponse.created(reply, transaction);
    },
  );

  fastify.post(
    '/transactions/:transactionId/reverse',
    {
      schema: {
        params: ledgerTransactionParamsSchema,
        body: reverseLedgerTransactionSchema,
        response: { 201: ledgerTransactionSchema },
      },
    },
    async (request, reply) => {
      const reversal = await fastify.ledgerService.reverseTransaction(
        request.params.transactionId,
        request.body,
      );

      return ApiResponse.created(reply, reversal);
    },
  );
};
