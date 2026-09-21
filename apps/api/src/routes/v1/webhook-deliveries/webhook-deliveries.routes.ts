import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { ApiResponse } from '@utils/api-response';
import {
  findWebhookDeliveriesSchema,
  ListResponseSchema,
  webhookDeliveryParamsSchema,
  webhookDeliverySchema,
} from '@vxrerp/platform/contracts';

export const webhookDeliveriesRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    '/',
    {
      schema: {
        operationId: 'webhookDeliveries.find',
        querystring: findWebhookDeliveriesSchema,
        response: { 200: ListResponseSchema(webhookDeliverySchema) },
      },
    },
    async (request, reply) => {
      const deliveries = await fastify.webhookService.findWebhookDeliveries(request.query);

      return ApiResponse.success(reply, deliveries);
    },
  );

  fastify.post(
    '/:webhookDeliveryId/replay',
    {
      schema: {
        operationId: 'webhookDeliveries.replay',
        params: webhookDeliveryParamsSchema,
        response: { 200: webhookDeliverySchema },
      },
    },
    async (request, reply) => {
      const delivery = await fastify.webhookService.replayWebhookDelivery(
        request.params.webhookDeliveryId,
      );

      return ApiResponse.success(reply, delivery);
    },
  );
};
