import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { ApiResponse } from '@utils/api-response';
import {
  checkoutSessionParamsSchema,
  checkoutSessionSchema,
  createCheckoutSessionSchema,
  findCheckoutSessionsSchema,
} from '@vxrerp/billing/contracts';
import { ListResponseSchema } from '@vxrerp/platform/contracts';

export const checkoutSessionsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    '/',
    {
      schema: {
        operationId: 'checkout.sessions.create',
        body: createCheckoutSessionSchema,
        response: { 201: checkoutSessionSchema },
      },
    },
    async (request, reply) => {
      const checkoutSession = await fastify.checkoutService.createCheckoutSession(request.body);

      return ApiResponse.created(reply, checkoutSession);
    },
  );

  fastify.get(
    '/',
    {
      schema: {
        operationId: 'checkout.sessions.find',
        querystring: findCheckoutSessionsSchema,
        response: { 200: ListResponseSchema(checkoutSessionSchema) },
      },
    },
    async (request, reply) => {
      const checkoutSessions = await fastify.checkoutService.findCheckoutSessions(request.query);

      return ApiResponse.success(reply, checkoutSessions);
    },
  );

  fastify.get(
    '/:checkoutSessionId',
    {
      schema: {
        operationId: 'checkout.sessions.get',
        params: checkoutSessionParamsSchema,
        response: { 200: checkoutSessionSchema },
      },
    },
    async (request, reply) => {
      const checkoutSession = await fastify.checkoutService.getCheckoutSession(
        request.params.checkoutSessionId,
      );

      return ApiResponse.success(reply, checkoutSession);
    },
  );
};
