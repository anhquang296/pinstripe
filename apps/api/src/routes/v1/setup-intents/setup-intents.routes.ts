import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  cancelSetupIntentSchema,
  confirmSetupIntentSchema,
  createSetupIntentSchema,
  findSetupIntentsSchema,
  ListResponseSchema,
  setupIntentParamsSchema,
  setupIntentSchema,
} from '@pinstripe/core/contracts';
import { ApiResponse } from '@utils/api-response';
import { readLivemode } from '@utils/request-auth';

export const setupIntentsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    '/',
    { schema: { body: createSetupIntentSchema, response: { 201: setupIntentSchema } } },
    async (request, reply) => {
      const setupIntent = await fastify.setupIntentService.createSetupIntent(
        request.body,
        readLivemode(request),
      );

      return ApiResponse.created(reply, setupIntent);
    },
  );

  fastify.get(
    '/',
    {
      schema: {
        querystring: findSetupIntentsSchema,
        response: { 200: ListResponseSchema(setupIntentSchema) },
      },
    },
    async (request, reply) => {
      const setupIntents = await fastify.setupIntentService.findSetupIntents(
        request.query,
        readLivemode(request),
      );

      return ApiResponse.success(reply, setupIntents);
    },
  );

  fastify.get(
    '/:setupIntentId',
    { schema: { params: setupIntentParamsSchema, response: { 200: setupIntentSchema } } },
    async (request, reply) => {
      const setupIntent = await fastify.setupIntentService.getSetupIntent(
        request.params.setupIntentId,
        readLivemode(request),
      );

      return ApiResponse.success(reply, setupIntent);
    },
  );

  fastify.post(
    '/:setupIntentId/confirm',
    {
      schema: {
        params: setupIntentParamsSchema,
        body: confirmSetupIntentSchema,
        response: { 200: setupIntentSchema },
      },
    },
    async (request, reply) => {
      const setupIntent = await fastify.setupIntentService.confirmSetupIntent(
        request.params.setupIntentId,
        request.body,
        readLivemode(request),
      );

      return ApiResponse.success(reply, setupIntent);
    },
  );

  fastify.post(
    '/:setupIntentId/cancel',
    {
      schema: {
        params: setupIntentParamsSchema,
        body: cancelSetupIntentSchema,
        response: { 200: setupIntentSchema },
      },
    },
    async (request, reply) => {
      const setupIntent = await fastify.setupIntentService.cancelSetupIntent(
        request.params.setupIntentId,
        request.body,
        readLivemode(request),
      );

      return ApiResponse.success(reply, setupIntent);
    },
  );
};
