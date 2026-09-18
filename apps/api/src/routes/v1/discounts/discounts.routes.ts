import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  createDiscountSchema,
  deletedDiscountSchema,
  discountParamsSchema,
  discountSchema,
  findDiscountsSchema,
  ListResponseSchema,
  updateDiscountSchema,
} from '@pinstripe/core/contracts';
import { ApiResponse } from '@utils/api-response';
import { readLivemode } from '@utils/request-auth';

export const discountsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    '/',
    { schema: { body: createDiscountSchema, response: { 201: discountSchema } } },
    async (request, reply) => {
      const discount = await fastify.discountService.createDiscount(
        request.body,
        readLivemode(request),
      );

      return ApiResponse.created(reply, discount);
    },
  );

  fastify.get(
    '/',
    {
      schema: {
        querystring: findDiscountsSchema,
        response: { 200: ListResponseSchema(discountSchema) },
      },
    },
    async (request, reply) => {
      const discounts = await fastify.discountService.findDiscounts(
        request.query,
        readLivemode(request),
      );

      return ApiResponse.success(reply, discounts);
    },
  );

  fastify.get(
    '/:discountId',
    { schema: { params: discountParamsSchema, response: { 200: discountSchema } } },
    async (request, reply) => {
      const discount = await fastify.discountService.getDiscount(
        request.params.discountId,
        readLivemode(request),
      );

      return ApiResponse.success(reply, discount);
    },
  );

  fastify.post(
    '/:discountId',
    {
      schema: {
        params: discountParamsSchema,
        body: updateDiscountSchema,
        response: { 200: discountSchema },
      },
    },
    async (request, reply) => {
      const discount = await fastify.discountService.updateDiscount(
        request.params.discountId,
        request.body,
        readLivemode(request),
      );

      return ApiResponse.success(reply, discount);
    },
  );

  fastify.delete(
    '/:discountId',
    { schema: { params: discountParamsSchema, response: { 200: deletedDiscountSchema } } },
    async (request, reply) => {
      const deletedDiscount = await fastify.discountService.deleteDiscount(
        request.params.discountId,
        readLivemode(request),
      );

      return ApiResponse.success(reply, deletedDiscount);
    },
  );
};
