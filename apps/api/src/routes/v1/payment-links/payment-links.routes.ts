import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  createPaymentLinkSchema,
  findPaymentLinksSchema,
  ListResponseSchema,
  paymentLinkParamsSchema,
  paymentLinkSchema,
  updatePaymentLinkSchema,
} from '@pinstripe/core/contracts';
import { ApiResponse } from '@utils/api-response';
import { readLivemode } from '@utils/request-auth';

export const paymentLinksRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    '/',
    { schema: { body: createPaymentLinkSchema, response: { 201: paymentLinkSchema } } },
    async (request, reply) => {
      const paymentLink = await fastify.paymentLinkService.createPaymentLink(
        request.body,
        readLivemode(request),
      );

      return ApiResponse.created(reply, paymentLink);
    },
  );

  fastify.get(
    '/',
    {
      schema: {
        querystring: findPaymentLinksSchema,
        response: { 200: ListResponseSchema(paymentLinkSchema) },
      },
    },
    async (request, reply) => {
      const paymentLinks = await fastify.paymentLinkService.findPaymentLinks(
        request.query,
        readLivemode(request),
      );

      return ApiResponse.success(reply, paymentLinks);
    },
  );

  fastify.get(
    '/:paymentLinkId',
    { schema: { params: paymentLinkParamsSchema, response: { 200: paymentLinkSchema } } },
    async (request, reply) => {
      const paymentLink = await fastify.paymentLinkService.getPaymentLink(
        request.params.paymentLinkId,
        readLivemode(request),
      );

      return ApiResponse.success(reply, paymentLink);
    },
  );

  fastify.post(
    '/:paymentLinkId',
    {
      schema: {
        params: paymentLinkParamsSchema,
        body: updatePaymentLinkSchema,
        response: { 200: paymentLinkSchema },
      },
    },
    async (request, reply) => {
      const paymentLink = await fastify.paymentLinkService.updatePaymentLink(
        request.params.paymentLinkId,
        request.body,
        readLivemode(request),
      );

      return ApiResponse.success(reply, paymentLink);
    },
  );
};
