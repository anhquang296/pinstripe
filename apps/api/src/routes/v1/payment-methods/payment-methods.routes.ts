import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  attachPaymentMethodSchema,
  createPaymentMethodSchema,
  findPaymentMethodsSchema,
  ListResponseSchema,
  paymentMethodParamsSchema,
  paymentMethodSchema,
  updatePaymentMethodSchema,
} from '@pinstripe/core/contracts';
import { ApiResponse } from '@utils/api-response';

export const paymentMethodsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    '/',
    { schema: { body: createPaymentMethodSchema, response: { 201: paymentMethodSchema } } },
    async (request, reply) => {
      const paymentMethod = await fastify.paymentMethodService.createPaymentMethod(request.body);

      return ApiResponse.created(reply, paymentMethod);
    },
  );

  fastify.get(
    '/',
    {
      schema: {
        querystring: findPaymentMethodsSchema,
        response: { 200: ListResponseSchema(paymentMethodSchema) },
      },
    },
    async (request, reply) => {
      const paymentMethods = await fastify.paymentMethodService.findPaymentMethods(request.query);

      return ApiResponse.success(reply, paymentMethods);
    },
  );

  fastify.get(
    '/:paymentMethodId',
    { schema: { params: paymentMethodParamsSchema, response: { 200: paymentMethodSchema } } },
    async (request, reply) => {
      const paymentMethod = await fastify.paymentMethodService.getPaymentMethod(
        request.params.paymentMethodId,
      );

      return ApiResponse.success(reply, paymentMethod);
    },
  );

  fastify.post(
    '/:paymentMethodId',
    {
      schema: {
        params: paymentMethodParamsSchema,
        body: updatePaymentMethodSchema,
        response: { 200: paymentMethodSchema },
      },
    },
    async (request, reply) => {
      const paymentMethod = await fastify.paymentMethodService.updatePaymentMethod(
        request.params.paymentMethodId,
        request.body,
      );

      return ApiResponse.success(reply, paymentMethod);
    },
  );

  fastify.post(
    '/:paymentMethodId/attach',
    {
      schema: {
        params: paymentMethodParamsSchema,
        body: attachPaymentMethodSchema,
        response: { 200: paymentMethodSchema },
      },
    },
    async (request, reply) => {
      const paymentMethod = await fastify.paymentMethodService.attachPaymentMethod(
        request.params.paymentMethodId,
        request.body,
      );

      return ApiResponse.success(reply, paymentMethod);
    },
  );

  fastify.post(
    '/:paymentMethodId/detach',
    { schema: { params: paymentMethodParamsSchema, response: { 200: paymentMethodSchema } } },
    async (request, reply) => {
      const paymentMethod = await fastify.paymentMethodService.detachPaymentMethod(
        request.params.paymentMethodId,
      );

      return ApiResponse.success(reply, paymentMethod);
    },
  );
};
