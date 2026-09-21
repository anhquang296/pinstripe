import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { ApiResponse } from '@utils/api-response';
import {
  createMeterEventBatchResponseSchema,
  createMeterEventBatchSchema,
  createMeterEventSchema,
  meterEventSchema,
} from '@vxrerp/core/contracts';

export const meterEventsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    '/meter_events',
    {
      schema: {
        operationId: 'billing.meterEvents.create',
        body: createMeterEventSchema,
        response: { 202: meterEventSchema },
      },
    },
    async (request, reply) => {
      const meterEvent = await fastify.meterEventService.ingestMeterEvent(request.body);

      return ApiResponse.accepted(reply, meterEvent);
    },
  );

  fastify.post(
    '/meter_event_batches',
    {
      schema: {
        operationId: 'billing.meterEventBatches.create',
        body: createMeterEventBatchSchema,
        response: { 202: createMeterEventBatchResponseSchema },
      },
    },
    async (request, reply) => {
      const batchResult = await fastify.meterEventService.ingestMeterEventBatch(request.body);

      return ApiResponse.accepted(reply, batchResult);
    },
  );
};
