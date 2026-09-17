import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  createMeterEventBatchResponseSchema,
  createMeterEventBatchSchema,
  createMeterEventSchema,
  meterEventSchema,
} from '@pinstripe/core/contracts';
import { ApiResponse } from '@utils/api-response';
import { readLivemode } from '@utils/request-auth';

export const meterEventsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    '/meter_events',
    { schema: { body: createMeterEventSchema, response: { 202: meterEventSchema } } },
    async (request, reply) => {
      const meterEvent = await fastify.meterEventService.ingestMeterEvent(
        request.body,
        readLivemode(request),
      );

      return ApiResponse.accepted(reply, meterEvent);
    },
  );

  fastify.post(
    '/meter_event_batches',
    {
      schema: {
        body: createMeterEventBatchSchema,
        response: { 202: createMeterEventBatchResponseSchema },
      },
    },
    async (request, reply) => {
      const batchResult = await fastify.meterEventService.ingestMeterEventBatch(
        request.body,
        readLivemode(request),
      );

      return ApiResponse.accepted(reply, batchResult);
    },
  );
};
