import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  createMeterSchema,
  findMetersSchema,
  getMeterEventSummarySchema,
  ListResponseSchema,
  meterEventSummarySchema,
  meterParamsSchema,
  meterSchema,
  updateMeterSchema,
} from '@pinstripe/core/contracts';
import { ApiResponse } from '@utils/api-response';

export const metersRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    '/',
    { schema: { body: createMeterSchema, response: { 201: meterSchema } } },
    async (request, reply) => {
      const meter = await fastify.meterService.createMeter(request.body);

      return ApiResponse.created(reply, meter);
    },
  );

  fastify.get(
    '/',
    {
      schema: { querystring: findMetersSchema, response: { 200: ListResponseSchema(meterSchema) } },
    },
    async (request, reply) => {
      const meters = await fastify.meterService.findMeters(request.query);

      return ApiResponse.success(reply, meters);
    },
  );

  fastify.get(
    '/:meterId',
    { schema: { params: meterParamsSchema, response: { 200: meterSchema } } },
    async (request, reply) => {
      const meter = await fastify.meterService.getMeter(request.params.meterId);

      return ApiResponse.success(reply, meter);
    },
  );

  fastify.post(
    '/:meterId',
    {
      schema: {
        params: meterParamsSchema,
        body: updateMeterSchema,
        response: { 200: meterSchema },
      },
    },
    async (request, reply) => {
      const meter = await fastify.meterService.updateMeter(request.params.meterId, request.body);

      return ApiResponse.success(reply, meter);
    },
  );

  fastify.get(
    '/:meterId/event_summaries',
    {
      schema: {
        params: meterParamsSchema,
        querystring: getMeterEventSummarySchema,
        response: { 200: meterEventSummarySchema },
      },
    },
    async (request, reply) => {
      const summary = await fastify.meterEventService.getMeterEventSummary(
        request.params.meterId,
        request.query,
      );

      return ApiResponse.success(reply, summary);
    },
  );
};
