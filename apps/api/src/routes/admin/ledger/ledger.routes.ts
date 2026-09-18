import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  findLedgerAccountsSchema,
  findLedgerTransactionsSchema,
  ledgerAccountParamsSchema,
  ledgerAccountSchema,
  ledgerTransactionParamsSchema,
  ledgerTransactionSchema,
  ListResponseSchema,
  PermissionEnum,
  postLedgerTransactionSchema,
  reverseLedgerTransactionSchema,
} from '@pinstripe/core/contracts';
import { ApiResponse } from '@utils/api-response';
import { buildRouteConfig } from '@utils/route-permission';

export const ledgerRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    '/accounts',
    {
      config: buildRouteConfig(PermissionEnum.BILLING_READ),
      schema: {
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
      config: buildRouteConfig(PermissionEnum.BILLING_READ),
      schema: { params: ledgerAccountParamsSchema, response: { 200: ledgerAccountSchema } },
    },
    async (request, reply) => {
      const account = await fastify.ledgerService.getAccount(request.params.accountId);

      return ApiResponse.success(reply, account);
    },
  );

  fastify.get(
    '/transactions',
    {
      config: buildRouteConfig(PermissionEnum.BILLING_READ),
      schema: {
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
      config: buildRouteConfig(PermissionEnum.BILLING_READ),
      schema: { params: ledgerTransactionParamsSchema, response: { 200: ledgerTransactionSchema } },
    },
    async (request, reply) => {
      const transaction = await fastify.ledgerService.getTransaction(request.params.transactionId);

      return ApiResponse.success(reply, transaction);
    },
  );

  fastify.post(
    '/transactions',
    {
      config: buildRouteConfig(PermissionEnum.LEDGER_WRITE),
      schema: { body: postLedgerTransactionSchema, response: { 201: ledgerTransactionSchema } },
    },
    async (request, reply) => {
      const transaction = await fastify.ledgerService.postTransaction(request.body);

      return ApiResponse.created(reply, transaction);
    },
  );

  fastify.post(
    '/transactions/:transactionId/reverse',
    {
      config: buildRouteConfig(PermissionEnum.LEDGER_WRITE),
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
