import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  findWebhookDeliveriesSchema,
  ListResponseSchema,
  webhookDeliverySchema,
} from '@pinstripe/core/contracts';
import { ApiResponse } from '@utils/api-response';

export const webhookDeliveriesRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    '/',
    {
      schema: {
        querystring: findWebhookDeliveriesSchema,
        response: { 200: ListResponseSchema(webhookDeliverySchema) },
      },
    },
    async (request, reply) => {
      const deliveries = await fastify.webhookService.findWebhookDeliveries(request.query);

      return ApiResponse.success(reply, deliveries);
    },
  );
};
