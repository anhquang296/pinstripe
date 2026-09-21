import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { ApiResponse } from '@utils/api-response';
import {
  createPaymentLinkSchema,
  findPaymentLinksSchema,
  ListResponseSchema,
  paymentLinkParamsSchema,
  paymentLinkSchema,
  updatePaymentLinkSchema,
} from '@vxrerp/core/contracts';

export const paymentLinksRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    '/',
    {
      schema: {
        operationId: 'paymentLinks.create',
        body: createPaymentLinkSchema,
        response: { 201: paymentLinkSchema },
      },
    },
    async (request, reply) => {
      const paymentLink = await fastify.paymentLinkService.createPaymentLink(request.body);

      return ApiResponse.created(reply, paymentLink);
    },
  );

  fastify.get(
    '/',
    {
      schema: {
        operationId: 'paymentLinks.find',
        querystring: findPaymentLinksSchema,
        response: { 200: ListResponseSchema(paymentLinkSchema) },
      },
    },
    async (request, reply) => {
      const paymentLinks = await fastify.paymentLinkService.findPaymentLinks(request.query);

      return ApiResponse.success(reply, paymentLinks);
    },
  );

  fastify.get(
    '/:paymentLinkId',
    {
      schema: {
        operationId: 'paymentLinks.get',
        params: paymentLinkParamsSchema,
        response: { 200: paymentLinkSchema },
      },
    },
    async (request, reply) => {
      const paymentLink = await fastify.paymentLinkService.getPaymentLink(
        request.params.paymentLinkId,
      );

      return ApiResponse.success(reply, paymentLink);
    },
  );

  fastify.post(
    '/:paymentLinkId',
    {
      schema: {
        operationId: 'paymentLinks.update',
        params: paymentLinkParamsSchema,
        body: updatePaymentLinkSchema,
        response: { 200: paymentLinkSchema },
      },
    },
    async (request, reply) => {
      const paymentLink = await fastify.paymentLinkService.updatePaymentLink(
        request.params.paymentLinkId,
        request.body,
      );

      return ApiResponse.success(reply, paymentLink);
    },
  );
};
