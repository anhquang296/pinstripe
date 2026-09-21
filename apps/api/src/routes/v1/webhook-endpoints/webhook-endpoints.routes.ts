import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { ApiResponse } from '@utils/api-response';
import {
  createWebhookEndpointSchema,
  findWebhookEndpointsSchema,
  ListResponseSchema,
  updateWebhookEndpointSchema,
  webhookEndpointParamsSchema,
  webhookEndpointSchema,
} from '@vxrerp/core/contracts';

export const webhookEndpointsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    '/',
    {
      schema: {
        operationId: 'webhookEndpoints.create',
        body: createWebhookEndpointSchema,
        response: { 201: webhookEndpointSchema },
      },
    },
    async (request, reply) => {
      const endpoint = await fastify.webhookService.createWebhookEndpoint(request.body);

      return ApiResponse.created(reply, endpoint);
    },
  );

  fastify.get(
    '/',
    {
      schema: {
        operationId: 'webhookEndpoints.find',
        querystring: findWebhookEndpointsSchema,
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
    {
      schema: {
        operationId: 'webhookEndpoints.get',
        params: webhookEndpointParamsSchema,
        response: { 200: webhookEndpointSchema },
      },
    },
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
        operationId: 'webhookEndpoints.update',
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
