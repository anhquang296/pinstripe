import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  createTaxRateSchema,
  findTaxRatesSchema,
  ListResponseSchema,
  taxRateParamsSchema,
  taxRateSchema,
  updateTaxRateSchema,
} from '@pinstripe/core/contracts';
import { ApiResponse } from '@utils/api-response';

export const taxRatesRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    '/',
    { schema: { body: createTaxRateSchema, response: { 201: taxRateSchema } } },
    async (request, reply) => {
      const taxRate = await fastify.taxRateService.createTaxRate(request.body);

      return ApiResponse.created(reply, taxRate);
    },
  );

  fastify.get(
    '/',
    {
      schema: {
        querystring: findTaxRatesSchema,
        response: { 200: ListResponseSchema(taxRateSchema) },
      },
    },
    async (request, reply) => {
      const taxRates = await fastify.taxRateService.findTaxRates(request.query);

      return ApiResponse.success(reply, taxRates);
    },
  );

  fastify.get(
    '/:taxRateId',
    { schema: { params: taxRateParamsSchema, response: { 200: taxRateSchema } } },
    async (request, reply) => {
      const taxRate = await fastify.taxRateService.getTaxRate(request.params.taxRateId);

      return ApiResponse.success(reply, taxRate);
    },
  );

  fastify.post(
    '/:taxRateId',
    {
      schema: {
        params: taxRateParamsSchema,
        body: updateTaxRateSchema,
        response: { 200: taxRateSchema },
      },
    },
    async (request, reply) => {
      const taxRate = await fastify.taxRateService.updateTaxRate(
        request.params.taxRateId,
        request.body,
      );

      return ApiResponse.success(reply, taxRate);
    },
  );
};
