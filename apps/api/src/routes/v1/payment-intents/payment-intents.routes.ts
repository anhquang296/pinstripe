import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  cancelPaymentIntentSchema,
  confirmPaymentIntentSchema,
  createPaymentIntentSchema,
  findPaymentIntentsSchema,
  ListResponseSchema,
  paymentIntentParamsSchema,
  paymentIntentSchema,
} from '@pinstripe/core/contracts';
import { ApiResponse } from '@utils/api-response';
import { readLivemode } from '@utils/request-auth';

export const paymentIntentsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    '/',
    { schema: { body: createPaymentIntentSchema, response: { 201: paymentIntentSchema } } },
    async (request, reply) => {
      const paymentIntent = await fastify.paymentService.createPaymentIntent(
        request.body,
        readLivemode(request),
      );

      return ApiResponse.created(reply, paymentIntent);
    },
  );

  fastify.get(
    '/',
    {
      schema: {
        querystring: findPaymentIntentsSchema,
        response: { 200: ListResponseSchema(paymentIntentSchema) },
      },
    },
    async (request, reply) => {
      const paymentIntents = await fastify.paymentService.findPaymentIntents(
        request.query,
        readLivemode(request),
      );

      return ApiResponse.success(reply, paymentIntents);
    },
  );

  fastify.get(
    '/:paymentIntentId',
    { schema: { params: paymentIntentParamsSchema, response: { 200: paymentIntentSchema } } },
    async (request, reply) => {
      const paymentIntent = await fastify.paymentService.getPaymentIntent(
        request.params.paymentIntentId,
        readLivemode(request),
      );

      return ApiResponse.success(reply, paymentIntent);
    },
  );

  fastify.post(
    '/:paymentIntentId/confirm',
    {
      schema: {
        params: paymentIntentParamsSchema,
        body: confirmPaymentIntentSchema,
        response: { 200: paymentIntentSchema },
      },
    },
    async (request, reply) => {
      const paymentIntent = await fastify.paymentService.confirmPaymentIntent(
        request.params.paymentIntentId,
        request.body,
        readLivemode(request),
      );

      return ApiResponse.success(reply, paymentIntent);
    },
  );

  fastify.post(
    '/:paymentIntentId/cancel',
    {
      schema: {
        params: paymentIntentParamsSchema,
        body: cancelPaymentIntentSchema,
        response: { 200: paymentIntentSchema },
      },
    },
    async (request, reply) => {
      const paymentIntent = await fastify.paymentService.cancelPaymentIntent(
        request.params.paymentIntentId,
        request.body,
        readLivemode(request),
      );

      return ApiResponse.success(reply, paymentIntent);
    },
  );
};
