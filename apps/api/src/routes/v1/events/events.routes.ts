import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  eventParamsSchema,
  eventSchema,
  findEventsSchema,
  ListResponseSchema,
} from '@pinstripe/core/contracts';
import { ApiResponse } from '@utils/api-response';

export const eventsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    '/',
    {
      schema: {
        operationId: 'events.find',
        querystring: findEventsSchema,
        response: { 200: ListResponseSchema(eventSchema) },
      },
    },
    async (request, reply) => {
      const events = await fastify.eventService.findEvents(request.query);

      return ApiResponse.success(reply, events);
    },
  );

  fastify.get(
    '/:eventId',
    {
      schema: {
        operationId: 'events.get',
        params: eventParamsSchema,
        response: { 200: eventSchema },
      },
    },
    async (request, reply) => {
      const event = await fastify.eventService.getEvent(request.params.eventId);

      return ApiResponse.success(reply, event);
    },
  );
};
