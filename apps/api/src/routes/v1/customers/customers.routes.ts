import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  createCustomerBalanceTransactionSchema,
  createCustomerSchema,
  customerBalanceTransactionSchema,
  customerParamsSchema,
  customerSchema,
  deletedCustomerSchema,
  findCustomerBalanceTransactionsSchema,
  findCustomersSchema,
  ListResponseSchema,
  updateCustomerSchema,
} from '@pinstripe/core/contracts';
import { ApiResponse } from '@utils/api-response';

export const customersRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    '/',
    {
      schema: {
        operationId: 'customers.create',
        body: createCustomerSchema,
        response: { 201: customerSchema },
      },
    },
    async (request, reply) => {
      const customer = await fastify.customerService.createCustomer(request.body);

      return ApiResponse.created(reply, customer);
    },
  );

  fastify.get(
    '/',
    {
      schema: {
        operationId: 'customers.find',
        querystring: findCustomersSchema,
        response: { 200: ListResponseSchema(customerSchema) },
      },
    },
    async (request, reply) => {
      const customers = await fastify.customerService.findCustomers(request.query);

      return ApiResponse.success(reply, customers);
    },
  );

  fastify.get(
    '/:customerId',
    {
      schema: {
        operationId: 'customers.get',
        params: customerParamsSchema,
        response: { 200: customerSchema },
      },
    },
    async (request, reply) => {
      const customer = await fastify.customerService.getCustomer(request.params.customerId);

      return ApiResponse.success(reply, customer);
    },
  );

  fastify.post(
    '/:customerId',
    {
      schema: {
        operationId: 'customers.update',
        params: customerParamsSchema,
        body: updateCustomerSchema,
        response: { 200: customerSchema },
      },
    },
    async (request, reply) => {
      const customer = await fastify.customerService.updateCustomer(
        request.params.customerId,
        request.body,
      );

      return ApiResponse.success(reply, customer);
    },
  );

  fastify.delete(
    '/:customerId',
    {
      schema: {
        operationId: 'customers.delete',
        params: customerParamsSchema,
        response: { 200: deletedCustomerSchema },
      },
    },
    async (request, reply) => {
      const deleted = await fastify.customerService.deleteCustomer(request.params.customerId);

      return ApiResponse.success(reply, deleted);
    },
  );

  fastify.post(
    '/:customerId/balance_transactions',
    {
      schema: {
        operationId: 'customers.createBalanceTransaction',
        params: customerParamsSchema,
        body: createCustomerBalanceTransactionSchema,
        response: { 201: customerBalanceTransactionSchema },
      },
    },
    async (request, reply) => {
      const balanceTransaction =
        await fastify.customerBalanceTransactionService.createCustomerBalanceTransaction(
          request.params.customerId,
          request.body,
        );

      return ApiResponse.created(reply, balanceTransaction);
    },
  );

  fastify.get(
    '/:customerId/balance_transactions',
    {
      schema: {
        operationId: 'customers.findBalanceTransactions',
        params: customerParamsSchema,
        querystring: findCustomerBalanceTransactionsSchema,
        response: { 200: ListResponseSchema(customerBalanceTransactionSchema) },
      },
    },
    async (request, reply) => {
      const balanceTransactions =
        await fastify.customerBalanceTransactionService.findCustomerBalanceTransactions(
          request.params.customerId,
          request.query,
        );

      return ApiResponse.success(reply, balanceTransactions);
    },
  );
};
