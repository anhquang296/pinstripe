import {
  createPriceSchema,
  getPricesSchema,
  ListResponseSchema,
  priceParamsSchema,
  priceSchema,
  updatePriceSchema,
} from '@pinstripe/core/contracts';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { ApiResponse } from '@utils/api-response';

export const pricesRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    '/',
    { schema: { body: createPriceSchema, response: { 201: priceSchema } } },
    async (request, reply) => {
      const price = await fastify.priceService.createPrice(request.body);

      return ApiResponse.created(reply, price);
    },
  );

  fastify.get(
    '/',
    {
      schema: { querystring: getPricesSchema, response: { 200: ListResponseSchema(priceSchema) } },
    },
    async (request, reply) => {
      const prices = await fastify.priceService.findPrices(request.query);

      return ApiResponse.success(reply, prices);
    },
  );

  fastify.get(
    '/:priceId',
    { schema: { params: priceParamsSchema, response: { 200: priceSchema } } },
    async (request, reply) => {
      const price = await fastify.priceService.getPrice(request.params.priceId);

      return ApiResponse.success(reply, price);
    },
  );

  fastify.post(
    '/:priceId',
    {
      schema: {
        params: priceParamsSchema,
        body: updatePriceSchema,
        response: { 200: priceSchema },
      },
    },
    async (request, reply) => {
      const price = await fastify.priceService.updatePrice(request.params.priceId, request.body);

      return ApiResponse.success(reply, price);
    },
  );
};
