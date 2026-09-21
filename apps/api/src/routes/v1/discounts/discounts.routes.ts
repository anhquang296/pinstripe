import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { ApiResponse } from '@utils/api-response';
import {
  createDiscountSchema,
  deletedDiscountSchema,
  discountParamsSchema,
  discountSchema,
  findDiscountsSchema,
  updateDiscountSchema,
} from '@vxrerp/billing/contracts';
import { ListResponseSchema } from '@vxrerp/platform/contracts';

export const discountsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    '/',
    {
      schema: {
        operationId: 'discounts.create',
        body: createDiscountSchema,
        response: { 201: discountSchema },
      },
    },
    async (request, reply) => {
      const discount = await fastify.discountService.createDiscount(request.body);

      return ApiResponse.created(reply, discount);
    },
  );

  fastify.get(
    '/',
    {
      schema: {
        operationId: 'discounts.find',
        querystring: findDiscountsSchema,
        response: { 200: ListResponseSchema(discountSchema) },
      },
    },
    async (request, reply) => {
      const discounts = await fastify.discountService.findDiscounts(request.query);

      return ApiResponse.success(reply, discounts);
    },
  );

  fastify.get(
    '/:discountId',
    {
      schema: {
        operationId: 'discounts.get',
        params: discountParamsSchema,
        response: { 200: discountSchema },
      },
    },
    async (request, reply) => {
      const discount = await fastify.discountService.getDiscount(request.params.discountId);

      return ApiResponse.success(reply, discount);
    },
  );

  fastify.post(
    '/:discountId',
    {
      schema: {
        operationId: 'discounts.update',
        params: discountParamsSchema,
        body: updateDiscountSchema,
        response: { 200: discountSchema },
      },
    },
    async (request, reply) => {
      const discount = await fastify.discountService.updateDiscount(
        request.params.discountId,
        request.body,
      );

      return ApiResponse.success(reply, discount);
    },
  );

  fastify.delete(
    '/:discountId',
    {
      schema: {
        operationId: 'discounts.delete',
        params: discountParamsSchema,
        response: { 200: deletedDiscountSchema },
      },
    },
    async (request, reply) => {
      const deletedDiscount = await fastify.discountService.deleteDiscount(
        request.params.discountId,
      );

      return ApiResponse.success(reply, deletedDiscount);
    },
  );
};
