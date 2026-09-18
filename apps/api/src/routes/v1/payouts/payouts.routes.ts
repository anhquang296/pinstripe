import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  createPayoutSchema,
  findPayoutsSchema,
  ListResponseSchema,
  payoutParamsSchema,
  payoutSchema,
} from '@pinstripe/core/contracts';
import { ApiResponse } from '@utils/api-response';

export const payoutsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    '/',
    { schema: { body: createPayoutSchema, response: { 201: payoutSchema } } },
    async (request, reply) => {
      const payout = await fastify.payoutService.createPayout(request.body);

      return ApiResponse.created(reply, payout);
    },
  );

  fastify.get(
    '/',
    {
      schema: {
        querystring: findPayoutsSchema,
        response: { 200: ListResponseSchema(payoutSchema) },
      },
    },
    async (request, reply) => {
      const payouts = await fastify.payoutService.findPayouts(request.query);

      return ApiResponse.success(reply, payouts);
    },
  );

  fastify.get(
    '/:payoutId',
    { schema: { params: payoutParamsSchema, response: { 200: payoutSchema } } },
    async (request, reply) => {
      const payout = await fastify.payoutService.getPayout(request.params.payoutId);

      return ApiResponse.success(reply, payout);
    },
  );
};
