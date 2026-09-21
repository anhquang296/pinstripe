import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { ApiResponse } from '@utils/api-response';
import {
  createRefundSchema,
  findRefundsSchema,
  ListResponseSchema,
  refundSchema,
} from '@vxrerp/core/contracts';

export const refundsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    '/',
    {
      schema: {
        operationId: 'refunds.create',
        body: createRefundSchema,
        response: { 201: refundSchema },
      },
    },
    async (request, reply) => {
      const refund = await fastify.refundService.createRefund(request.body);

      return ApiResponse.created(reply, refund);
    },
  );

  fastify.get(
    '/',
    {
      schema: {
        operationId: 'refunds.find',
        querystring: findRefundsSchema,
        response: { 200: ListResponseSchema(refundSchema) },
      },
    },
    async (request, reply) => {
      const refunds = await fastify.refundService.findRefunds(request.query);

      return ApiResponse.success(reply, refunds);
    },
  );

  fastify.get(
    '/:refundId',
    {
      schema: {
        operationId: 'refunds.get',
        params: Type.Object({ refundId: Type.String() }),
        response: { 200: refundSchema },
      },
    },
    async (request, reply) => {
      const refund = await fastify.refundService.getRefund(request.params.refundId);

      return ApiResponse.success(reply, refund);
    },
  );
};
