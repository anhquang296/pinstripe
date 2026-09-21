import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { ApiResponse } from '@utils/api-response';
import {
  cancelSubscriptionSchema,
  createSubscriptionSchema,
  findSubscriptionsSchema,
  subscriptionParamsSchema,
  subscriptionSchema,
  updateSubscriptionSchema,
} from '@vxrerp/billing/contracts';
import { ListResponseSchema } from '@vxrerp/platform/contracts';

export const subscriptionsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    '/',
    {
      schema: {
        operationId: 'subscriptions.create',
        body: createSubscriptionSchema,
        response: { 201: subscriptionSchema },
      },
    },
    async (request, reply) => {
      const subscription = await fastify.subscriptionService.createSubscription(request.body);

      return ApiResponse.created(reply, subscription);
    },
  );

  fastify.get(
    '/',
    {
      schema: {
        operationId: 'subscriptions.find',
        querystring: findSubscriptionsSchema,
        response: { 200: ListResponseSchema(subscriptionSchema) },
      },
    },
    async (request, reply) => {
      const subscriptions = await fastify.subscriptionService.findSubscriptions(request.query);

      return ApiResponse.success(reply, subscriptions);
    },
  );

  fastify.get(
    '/:subscriptionId',
    {
      schema: {
        operationId: 'subscriptions.get',
        params: subscriptionParamsSchema,
        response: { 200: subscriptionSchema },
      },
    },
    async (request, reply) => {
      const subscription = await fastify.subscriptionService.getSubscription(
        request.params.subscriptionId,
      );

      return ApiResponse.success(reply, subscription);
    },
  );

  fastify.post(
    '/:subscriptionId',
    {
      schema: {
        operationId: 'subscriptions.update',
        params: subscriptionParamsSchema,
        body: updateSubscriptionSchema,
        response: { 200: subscriptionSchema },
      },
    },
    async (request, reply) => {
      const subscription = await fastify.subscriptionService.updateSubscription(
        request.params.subscriptionId,
        request.body,
      );

      return ApiResponse.success(reply, subscription);
    },
  );

  fastify.delete(
    '/:subscriptionId',
    {
      schema: {
        operationId: 'subscriptions.cancel',
        params: subscriptionParamsSchema,
        body: cancelSubscriptionSchema,
        response: { 200: subscriptionSchema },
      },
    },
    async (request, reply) => {
      const { body: payload = {} } = request;

      const subscription = await fastify.subscriptionService.cancelSubscription(
        request.params.subscriptionId,
        payload,
      );

      return ApiResponse.success(reply, subscription);
    },
  );
};
