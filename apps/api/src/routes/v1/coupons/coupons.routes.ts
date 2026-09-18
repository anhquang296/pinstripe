import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  couponParamsSchema,
  couponSchema,
  createCouponSchema,
  deletedCouponSchema,
  findCouponsSchema,
  ListResponseSchema,
  updateCouponSchema,
} from '@pinstripe/core/contracts';
import { ApiResponse } from '@utils/api-response';

export const couponsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    '/',
    { schema: { body: createCouponSchema, response: { 201: couponSchema } } },
    async (request, reply) => {
      const coupon = await fastify.couponService.createCoupon(request.body);

      return ApiResponse.created(reply, coupon);
    },
  );

  fastify.get(
    '/',
    {
      schema: {
        querystring: findCouponsSchema,
        response: { 200: ListResponseSchema(couponSchema) },
      },
    },
    async (request, reply) => {
      const coupons = await fastify.couponService.findCoupons(request.query);

      return ApiResponse.success(reply, coupons);
    },
  );

  fastify.get(
    '/:couponId',
    { schema: { params: couponParamsSchema, response: { 200: couponSchema } } },
    async (request, reply) => {
      const coupon = await fastify.couponService.getCoupon(request.params.couponId);

      return ApiResponse.success(reply, coupon);
    },
  );

  fastify.post(
    '/:couponId',
    {
      schema: {
        params: couponParamsSchema,
        body: updateCouponSchema,
        response: { 200: couponSchema },
      },
    },
    async (request, reply) => {
      const coupon = await fastify.couponService.updateCoupon(
        request.params.couponId,
        request.body,
      );

      return ApiResponse.success(reply, coupon);
    },
  );

  fastify.delete(
    '/:couponId',
    { schema: { params: couponParamsSchema, response: { 200: deletedCouponSchema } } },
    async (request, reply) => {
      const deletedCoupon = await fastify.couponService.deleteCoupon(request.params.couponId);

      return ApiResponse.success(reply, deletedCoupon);
    },
  );
};
