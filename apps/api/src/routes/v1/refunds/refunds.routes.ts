import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  createRefundSchema,
  getRefundsSchema,
  ListResponseSchema,
  refundSchema,
} from '@pinstripe/core/contracts';
import { Type } from '@sinclair/typebox';
import { ApiResponse } from '@utils/api-response';

export const refundsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    '/',
    { schema: { body: createRefundSchema, response: { 201: refundSchema } } },
    async (request, reply) => {
      const refund = await fastify.refundService.createRefund(request.body);

      return ApiResponse.created(reply, refund);
    },
  );

  fastify.get(
    '/',
    {
      schema: {
        querystring: getRefundsSchema,
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
