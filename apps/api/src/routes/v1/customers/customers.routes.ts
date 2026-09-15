import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  createCustomerSchema,
  customerParamsSchema,
  customerSchema,
  getCustomersSchema,
  ListResponseSchema,
  updateCustomerSchema,
} from '@pinstripe/core/contracts';
import { Type } from '@sinclair/typebox';
import { ApiResponse } from '@utils/api-response';

export const customersRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    '/',
    { schema: { body: createCustomerSchema, response: { 201: customerSchema } } },
    async (request, reply) => {
      const customer = await fastify.customerService.createCustomer(request.body);

      return ApiResponse.created(reply, customer);
    },
  );

  fastify.get(
    '/',
    {
      schema: {
        querystring: getCustomersSchema,
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
    { schema: { params: customerParamsSchema, response: { 200: customerSchema } } },
    async (request, reply) => {
      const customer = await fastify.customerService.getCustomer(request.params.customerId);

      return ApiResponse.success(reply, customer);
    },
  );

  fastify.post(
    '/:customerId',
    {
      schema: {
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
        params: customerParamsSchema,
        response: {
          200: Type.Object({
            object: Type.Literal('customer'),
            id: Type.String(),
            deleted: Type.Literal(true),
          }),
        },
      },
    },
    async (request, reply) => {
      const deleted = await fastify.customerService.deleteCustomer(request.params.customerId);

      return ApiResponse.success(reply, deleted);
    },
  );
};
