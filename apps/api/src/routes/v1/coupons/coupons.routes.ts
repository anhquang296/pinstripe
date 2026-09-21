import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { ApiResponse } from '@utils/api-response';
import {
  couponParamsSchema,
  couponSchema,
  createCouponSchema,
  deletedCouponSchema,
  findCouponsSchema,
  updateCouponSchema,
} from '@vxrerp/billing/contracts';
import { ListResponseSchema } from '@vxrerp/platform/contracts';

export const couponsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    '/',
    {
      schema: {
        operationId: 'coupons.create',
        body: createCouponSchema,
        response: { 201: couponSchema },
      },
    },
    async (request, reply) => {
      const coupon = await fastify.couponService.createCoupon(request.body);

      return ApiResponse.created(reply, coupon);
    },
  );

  fastify.get(
    '/',
    {
      schema: {
        operationId: 'coupons.find',
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
    {
      schema: {
        operationId: 'coupons.get',
        params: couponParamsSchema,
        response: { 200: couponSchema },
      },
    },
    async (request, reply) => {
      const coupon = await fastify.couponService.getCoupon(request.params.couponId);

      return ApiResponse.success(reply, coupon);
    },
  );

  fastify.post(
    '/:couponId',
    {
      schema: {
        operationId: 'coupons.update',
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
    {
      schema: {
        operationId: 'coupons.delete',
        params: couponParamsSchema,
        response: { 200: deletedCouponSchema },
      },
    },
    async (request, reply) => {
      const deletedCoupon = await fastify.couponService.deleteCoupon(request.params.couponId);

      return ApiResponse.success(reply, deletedCoupon);
    },
  );
};
