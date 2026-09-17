import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  cancelSubscriptionSchema,
  createSubscriptionSchema,
  findSubscriptionsSchema,
  ListResponseSchema,
  subscriptionParamsSchema,
  subscriptionSchema,
  updateSubscriptionSchema,
} from '@pinstripe/core/contracts';
import { ApiResponse } from '@utils/api-response';
import { readLivemode } from '@utils/request-auth';

export const subscriptionsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    '/',
    { schema: { body: createSubscriptionSchema, response: { 201: subscriptionSchema } } },
    async (request, reply) => {
      const subscription = await fastify.subscriptionService.createSubscription(
        request.body,
        readLivemode(request),
      );

      return ApiResponse.created(reply, subscription);
    },
  );

  fastify.get(
    '/',
    {
      schema: {
        querystring: findSubscriptionsSchema,
        response: { 200: ListResponseSchema(subscriptionSchema) },
      },
    },
    async (request, reply) => {
      const subscriptions = await fastify.subscriptionService.findSubscriptions(
        request.query,
        readLivemode(request),
      );

      return ApiResponse.success(reply, subscriptions);
    },
  );

  fastify.get(
    '/:subscriptionId',
    { schema: { params: subscriptionParamsSchema, response: { 200: subscriptionSchema } } },
    async (request, reply) => {
      const subscription = await fastify.subscriptionService.getSubscription(
        request.params.subscriptionId,
        readLivemode(request),
      );

      return ApiResponse.success(reply, subscription);
    },
  );

  fastify.post(
    '/:subscriptionId',
    {
      schema: {
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
        params: subscriptionParamsSchema,
        body: cancelSubscriptionSchema,
        response: { 200: subscriptionSchema },
      },
    },
    async (request, reply) => {
      const subscription = await fastify.subscriptionService.cancelSubscription(
        request.params.subscriptionId,
        request.body ?? {},
      );

      return ApiResponse.success(reply, subscription);
    },
  );
};
