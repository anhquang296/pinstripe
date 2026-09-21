import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { ApiResponse } from '@utils/api-response';
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
} from '@vxrerp/core/contracts';

export const billingPortalRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    '/configurations',
    {
      schema: {
        operationId: 'billingPortal.configurations.create',
        body: createBillingPortalConfigurationSchema,
        response: { 201: billingPortalConfigurationSchema },
      },
    },
    async (request, reply) => {
      const configuration = await fastify.billingPortalService.createConfiguration(request.body);

      return ApiResponse.created(reply, configuration);
    },
  );

  fastify.get(
    '/configurations',
    {
      schema: {
        operationId: 'billingPortal.configurations.find',
        querystring: findBillingPortalConfigurationsSchema,
        response: { 200: ListResponseSchema(billingPortalConfigurationSchema) },
      },
    },
    async (request, reply) => {
      const configurations = await fastify.billingPortalService.findConfigurations(request.query);

      return ApiResponse.success(reply, configurations);
    },
  );

  fastify.get(
    '/configurations/:configurationId',
    {
      schema: {
        operationId: 'billingPortal.configurations.get',
        params: billingPortalConfigurationParamsSchema,
        response: { 200: billingPortalConfigurationSchema },
      },
    },
    async (request, reply) => {
      const configuration = await fastify.billingPortalService.getConfiguration(
        request.params.configurationId,
      );

      return ApiResponse.success(reply, configuration);
    },
  );

  fastify.post(
    '/configurations/:configurationId',
    {
      schema: {
        operationId: 'billingPortal.configurations.update',
        params: billingPortalConfigurationParamsSchema,
        body: updateBillingPortalConfigurationSchema,
        response: { 200: billingPortalConfigurationSchema },
      },
    },
    async (request, reply) => {
      const configuration = await fastify.billingPortalService.updateConfiguration(
        request.params.configurationId,
        request.body,
      );

      return ApiResponse.success(reply, configuration);
    },
  );

  fastify.post(
    '/sessions',
    {
      schema: {
        operationId: 'billingPortal.sessions.create',
        body: createBillingPortalSessionSchema,
        response: { 201: billingPortalSessionSchema },
      },
    },
    async (request, reply) => {
      const session = await fastify.billingPortalService.createSession(request.body);

      return ApiResponse.created(reply, session);
    },
  );

  fastify.get(
    '/sessions/:sessionId',
    {
      schema: {
        operationId: 'billingPortal.sessions.get',
        params: billingPortalSessionParamsSchema,
        response: { 200: billingPortalSessionSchema },
      },
    },
    async (request, reply) => {
      const session = await fastify.billingPortalService.getSession(request.params.sessionId);

      return ApiResponse.success(reply, session);
    },
  );
};
