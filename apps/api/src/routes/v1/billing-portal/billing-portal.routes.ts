import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  billingPortalConfigurationParamsSchema,
  billingPortalConfigurationSchema,
  billingPortalSessionParamsSchema,
  billingPortalSessionSchema,
  createBillingPortalConfigurationSchema,
  createBillingPortalSessionSchema,
  findBillingPortalConfigurationsSchema,
  ListResponseSchema,
  updateBillingPortalConfigurationSchema,
} from '@pinstripe/core/contracts';
import { ApiResponse } from '@utils/api-response';
import { readLivemode } from '@utils/request-auth';

export const billingPortalRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    '/configurations',
    {
      schema: {
        body: createBillingPortalConfigurationSchema,
        response: { 201: billingPortalConfigurationSchema },
      },
    },
    async (request, reply) => {
      const configuration = await fastify.billingPortalService.createConfiguration(
        request.body,
        readLivemode(request),
      );

      return ApiResponse.created(reply, configuration);
    },
  );

  fastify.get(
    '/configurations',
    {
      schema: {
        querystring: findBillingPortalConfigurationsSchema,
        response: { 200: ListResponseSchema(billingPortalConfigurationSchema) },
      },
    },
    async (request, reply) => {
      const configurations = await fastify.billingPortalService.findConfigurations(
        request.query,
        readLivemode(request),
      );

      return ApiResponse.success(reply, configurations);
    },
  );

  fastify.get(
    '/configurations/:configurationId',
    {
      schema: {
        params: billingPortalConfigurationParamsSchema,
        response: { 200: billingPortalConfigurationSchema },
      },
    },
    async (request, reply) => {
      const configuration = await fastify.billingPortalService.getConfiguration(
        request.params.configurationId,
        readLivemode(request),
      );

      return ApiResponse.success(reply, configuration);
    },
  );

  fastify.post(
    '/configurations/:configurationId',
    {
      schema: {
        params: billingPortalConfigurationParamsSchema,
        body: updateBillingPortalConfigurationSchema,
        response: { 200: billingPortalConfigurationSchema },
      },
    },
    async (request, reply) => {
      const configuration = await fastify.billingPortalService.updateConfiguration(
        request.params.configurationId,
        request.body,
        readLivemode(request),
      );

      return ApiResponse.success(reply, configuration);
    },
  );

  fastify.post(
    '/sessions',
    {
      schema: {
        body: createBillingPortalSessionSchema,
        response: { 201: billingPortalSessionSchema },
      },
    },
    async (request, reply) => {
      const session = await fastify.billingPortalService.createSession(
        request.body,
        readLivemode(request),
      );

      return ApiResponse.created(reply, session);
    },
  );

  fastify.get(
    '/sessions/:sessionId',
    {
      schema: {
        params: billingPortalSessionParamsSchema,
        response: { 200: billingPortalSessionSchema },
      },
    },
    async (request, reply) => {
      const session = await fastify.billingPortalService.getSession(
        request.params.sessionId,
        readLivemode(request),
      );

      return ApiResponse.success(reply, session);
    },
  );
};
