import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  createWebhookEndpointSchema,
  getWebhookEndpointsSchema,
  ListResponseSchema,
  updateWebhookEndpointSchema,
  webhookEndpointParamsSchema,
  webhookEndpointSchema,
} from '@pinstripe/core/contracts';
import { ApiResponse } from '@utils/api-response';
import { readLivemode } from '@utils/request-auth';

export const webhookEndpointsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    '/',
    { schema: { body: createWebhookEndpointSchema, response: { 201: webhookEndpointSchema } } },
    async (request, reply) => {
      const endpoint = await fastify.webhookService.createWebhookEndpoint(
        request.body,
        readLivemode(request),
      );

      return ApiResponse.created(reply, endpoint);
    },
  );

  fastify.get(
    '/',
    {
      schema: {
        querystring: getWebhookEndpointsSchema,
        response: { 200: ListResponseSchema(webhookEndpointSchema) },
      },
    },
    async (request, reply) => {
      const endpoints = await fastify.webhookService.findWebhookEndpoints(request.query);

      return ApiResponse.success(reply, endpoints);
    },
  );

  fastify.get(
    '/:webhookEndpointId',
    { schema: { params: webhookEndpointParamsSchema, response: { 200: webhookEndpointSchema } } },
    async (request, reply) => {
      const endpoint = await fastify.webhookService.getWebhookEndpoint(
        request.params.webhookEndpointId,
      );

      return ApiResponse.success(reply, endpoint);
    },
  );

  fastify.post(
    '/:webhookEndpointId',
    {
      schema: {
        params: webhookEndpointParamsSchema,
        body: updateWebhookEndpointSchema,
        response: { 200: webhookEndpointSchema },
      },
    },
    async (request, reply) => {
      const endpoint = await fastify.webhookService.updateWebhookEndpoint(
        request.params.webhookEndpointId,
        request.body,
      );

      return ApiResponse.success(reply, endpoint);
    },
  );
};
