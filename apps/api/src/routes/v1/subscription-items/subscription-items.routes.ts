import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  createSubscriptionItemSchema,
  deletedSubscriptionItemSchema,
  deleteSubscriptionItemSchema,
  findSubscriptionItemsSchema,
  ListResponseSchema,
  subscriptionItemParamsSchema,
  subscriptionItemSchema,
  updateSubscriptionItemSchema,
} from '@pinstripe/core/contracts';
import { ApiResponse } from '@utils/api-response';

export const subscriptionItemsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    '/',
    {
      schema: {
        operationId: 'subscriptionItems.create',
        body: createSubscriptionItemSchema,
        response: { 201: subscriptionItemSchema },
      },
    },
    async (request, reply) => {
      const subscriptionItem = await fastify.subscriptionItemService.createSubscriptionItem(
        request.body,
      );

      return ApiResponse.created(reply, subscriptionItem);
    },
  );

  fastify.get(
    '/',
    {
      schema: {
        operationId: 'subscriptionItems.find',
        querystring: findSubscriptionItemsSchema,
        response: { 200: ListResponseSchema(subscriptionItemSchema) },
      },
    },
    async (request, reply) => {
      const subscriptionItems = await fastify.subscriptionItemService.findSubscriptionItems(
        request.query,
      );

      return ApiResponse.success(reply, subscriptionItems);
    },
  );

  fastify.get(
    '/:subscriptionItemId',
    {
      schema: {
        operationId: 'subscriptionItems.get',
        params: subscriptionItemParamsSchema,
        response: { 200: subscriptionItemSchema },
      },
    },
    async (request, reply) => {
      const subscriptionItem = await fastify.subscriptionItemService.getSubscriptionItem(
        request.params.subscriptionItemId,
      );

      return ApiResponse.success(reply, subscriptionItem);
    },
  );

  fastify.post(
    '/:subscriptionItemId',
    {
      schema: {
        operationId: 'subscriptionItems.update',
        params: subscriptionItemParamsSchema,
        body: updateSubscriptionItemSchema,
        response: { 200: subscriptionItemSchema },
      },
    },
    async (request, reply) => {
      const subscriptionItem = await fastify.subscriptionItemService.updateSubscriptionItem(
        request.params.subscriptionItemId,
        request.body,
      );

      return ApiResponse.success(reply, subscriptionItem);
    },
  );

  fastify.delete(
    '/:subscriptionItemId',
    {
      schema: {
        operationId: 'subscriptionItems.delete',
        params: subscriptionItemParamsSchema,
        body: deleteSubscriptionItemSchema,
        response: { 200: deletedSubscriptionItemSchema },
      },
    },
    async (request, reply) => {
      const { body: payload = {} } = request;

      const deletedSubscriptionItem = await fastify.subscriptionItemService.deleteSubscriptionItem(
        request.params.subscriptionItemId,
        payload,
      );

      return ApiResponse.success(reply, deletedSubscriptionItem);
    },
  );
};
