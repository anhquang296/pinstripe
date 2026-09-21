import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { ApiResponse } from '@utils/api-response';
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
} from '@vxrerp/core/contracts';

export const ledgerRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    '/accounts',
    {
      schema: {
        operationId: 'ledger.accounts.find',
        querystring: findLedgerAccountsSchema,
        response: { 200: ListResponseSchema(ledgerAccountSchema) },
      },
    },
    async (request, reply) => {
      const accounts = await fastify.ledgerService.findAccounts(request.query);

      return ApiResponse.success(reply, accounts);
    },
  );

  fastify.get(
    '/accounts/:accountId',
    {
      schema: {
        operationId: 'ledger.accounts.get',
        params: ledgerAccountParamsSchema,
        response: { 200: ledgerAccountSchema },
      },
    },
    async (request, reply) => {
      const account = await fastify.ledgerService.getAccount(request.params.accountId);

      return ApiResponse.success(reply, account);
    },
  );

  fastify.get(
    '/transactions',
    {
      schema: {
        operationId: 'ledger.transactions.find',
        querystring: findLedgerTransactionsSchema,
        response: { 200: ListResponseSchema(ledgerTransactionSchema) },
      },
    },
    async (request, reply) => {
      const transactions = await fastify.ledgerService.findTransactions(request.query);

      return ApiResponse.success(reply, transactions);
    },
  );

  fastify.get(
    '/transactions/:transactionId',
    {
      schema: {
        operationId: 'ledger.transactions.get',
        params: ledgerTransactionParamsSchema,
        response: { 200: ledgerTransactionSchema },
      },
    },
    async (request, reply) => {
      const transaction = await fastify.ledgerService.getTransaction(request.params.transactionId);

      return ApiResponse.success(reply, transaction);
    },
  );

  fastify.post(
    '/transactions',
    {
      schema: {
        operationId: 'ledger.transactions.create',
        body: postLedgerTransactionSchema,
        response: { 201: ledgerTransactionSchema },
      },
    },
    async (request, reply) => {
      const transaction = await fastify.ledgerService.postTransaction(request.body);

      return ApiResponse.created(reply, transaction);
    },
  );

  fastify.post(
    '/transactions/:transactionId/reverse',
    {
      schema: {
        operationId: 'ledger.transactions.reverse',
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
