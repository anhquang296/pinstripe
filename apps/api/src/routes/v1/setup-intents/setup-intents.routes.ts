import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { ApiResponse } from '@utils/api-response';
import {
  cancelSetupIntentSchema,
  confirmSetupIntentSchema,
  createSetupIntentSchema,
  findSetupIntentsSchema,
  ListResponseSchema,
  setupIntentParamsSchema,
  setupIntentSchema,
} from '@vxrerp/core/contracts';

export const setupIntentsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    '/',
    {
      schema: {
        operationId: 'setupIntents.create',
        body: createSetupIntentSchema,
        response: { 201: setupIntentSchema },
      },
    },
    async (request, reply) => {
      const setupIntent = await fastify.setupIntentService.createSetupIntent(request.body);

      return ApiResponse.created(reply, setupIntent);
    },
  );

  fastify.get(
    '/',
    {
      schema: {
        operationId: 'setupIntents.find',
        querystring: findSetupIntentsSchema,
        response: { 200: ListResponseSchema(setupIntentSchema) },
      },
    },
    async (request, reply) => {
      const setupIntents = await fastify.setupIntentService.findSetupIntents(request.query);

      return ApiResponse.success(reply, setupIntents);
    },
  );

  fastify.get(
    '/:setupIntentId',
    {
      schema: {
        operationId: 'setupIntents.get',
        params: setupIntentParamsSchema,
        response: { 200: setupIntentSchema },
      },
    },
    async (request, reply) => {
      const setupIntent = await fastify.setupIntentService.getSetupIntent(
        request.params.setupIntentId,
      );

      return ApiResponse.success(reply, setupIntent);
    },
  );

  fastify.post(
    '/:setupIntentId/confirm',
    {
      schema: {
        operationId: 'setupIntents.confirm',
        params: setupIntentParamsSchema,
        body: confirmSetupIntentSchema,
        response: { 200: setupIntentSchema },
      },
    },
    async (request, reply) => {
      const setupIntent = await fastify.setupIntentService.confirmSetupIntent(
        request.params.setupIntentId,
        request.body,
      );

      return ApiResponse.success(reply, setupIntent);
    },
  );

  fastify.post(
    '/:setupIntentId/cancel',
    {
      schema: {
        operationId: 'setupIntents.cancel',
        params: setupIntentParamsSchema,
        body: cancelSetupIntentSchema,
        response: { 200: setupIntentSchema },
      },
    },
    async (request, reply) => {
      const setupIntent = await fastify.setupIntentService.cancelSetupIntent(
        request.params.setupIntentId,
        request.body,
      );

      return ApiResponse.success(reply, setupIntent);
    },
  );
};
