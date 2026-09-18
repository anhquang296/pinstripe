import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  createRefundSchema,
  findRefundsSchema,
  ListResponseSchema,
  refundSchema,
} from '@pinstripe/core/contracts';
import { Type } from '@sinclair/typebox';
import { ApiResponse } from '@utils/api-response';
import { readLivemode } from '@utils/request-auth';

export const refundsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    '/',
    { schema: { body: createRefundSchema, response: { 201: refundSchema } } },
    async (request, reply) => {
      const refund = await fastify.refundService.createRefund(request.body, readLivemode(request));

      return ApiResponse.created(reply, refund);
    },
  );

  fastify.get(
    '/',
    {
      schema: {
        querystring: findRefundsSchema,
        response: { 200: ListResponseSchema(refundSchema) },
      },
    },
    async (request, reply) => {
      const refunds = await fastify.refundService.findRefunds(request.query, readLivemode(request));

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
      const refund = await fastify.refundService.getRefund(
        request.params.refundId,
        readLivemode(request),
      );

      return ApiResponse.success(reply, refund);
    },
  );
};
