import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  findWebhookDeliveriesSchema,
  ListResponseSchema,
  webhookDeliveryParamsSchema,
  webhookDeliverySchema,
} from '@pinstripe/core/contracts';
import { ApiResponse } from '@utils/api-response';
import { readLivemode } from '@utils/request-auth';

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
      const deliveries = await fastify.webhookService.findWebhookDeliveries(
        request.query,
        readLivemode(request),
      );

      return ApiResponse.success(reply, deliveries);
    },
  );

  fastify.post(
    '/:webhookDeliveryId/replay',
    { schema: { params: webhookDeliveryParamsSchema, response: { 200: webhookDeliverySchema } } },
    async (request, reply) => {
      const delivery = await fastify.webhookService.replayWebhookDelivery(
        request.params.webhookDeliveryId,
        readLivemode(request),
      );

      return ApiResponse.success(reply, delivery);
    },
  );
};
