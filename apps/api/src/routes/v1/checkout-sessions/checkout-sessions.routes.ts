import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  checkoutSessionParamsSchema,
  checkoutSessionSchema,
  createCheckoutSessionSchema,
  findCheckoutSessionsSchema,
  ListResponseSchema,
} from '@pinstripe/core/contracts';
import { ApiResponse } from '@utils/api-response';
import { readLivemode } from '@utils/request-auth';

export const checkoutSessionsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    '/',
    { schema: { body: createCheckoutSessionSchema, response: { 201: checkoutSessionSchema } } },
    async (request, reply) => {
      const checkoutSession = await fastify.checkoutService.createCheckoutSession(
        request.body,
        readLivemode(request),
      );

      return ApiResponse.created(reply, checkoutSession);
    },
  );

  fastify.get(
    '/',
    {
      schema: {
        querystring: findCheckoutSessionsSchema,
        response: { 200: ListResponseSchema(checkoutSessionSchema) },
      },
    },
    async (request, reply) => {
      const checkoutSessions = await fastify.checkoutService.findCheckoutSessions(
        request.query,
        readLivemode(request),
      );

      return ApiResponse.success(reply, checkoutSessions);
    },
  );

  fastify.get(
    '/:checkoutSessionId',
    { schema: { params: checkoutSessionParamsSchema, response: { 200: checkoutSessionSchema } } },
    async (request, reply) => {
      const checkoutSession = await fastify.checkoutService.getCheckoutSession(
        request.params.checkoutSessionId,
        readLivemode(request),
      );

      return ApiResponse.success(reply, checkoutSession);
    },
  );
};
