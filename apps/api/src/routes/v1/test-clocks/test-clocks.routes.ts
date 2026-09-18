import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  advanceTestClockSchema,
  createTestClockSchema,
  findTestClocksSchema,
  ListResponseSchema,
  testClockParamsSchema,
  testClockSchema,
} from '@pinstripe/core/contracts';
import { ApiResponse } from '@utils/api-response';

export const testClocksRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    '/',
    { schema: { body: createTestClockSchema, response: { 201: testClockSchema } } },
    async (request, reply) => {
      const clock = await fastify.testClockService.createTestClock(request.body);

      return ApiResponse.created(reply, clock);
    },
  );

  fastify.get(
    '/',
    {
      schema: {
        querystring: findTestClocksSchema,
        response: { 200: ListResponseSchema(testClockSchema) },
      },
    },
    async (request, reply) => {
      const clocks = await fastify.testClockService.findTestClocks(request.query);

      return ApiResponse.success(reply, clocks);
    },
  );

  fastify.get(
    '/:testClockId',
    { schema: { params: testClockParamsSchema, response: { 200: testClockSchema } } },
    async (request, reply) => {
      const clock = await fastify.testClockService.getTestClock(request.params.testClockId);

      return ApiResponse.success(reply, clock);
    },
  );

  fastify.post(
    '/:testClockId/advance',
    {
      schema: {
        params: testClockParamsSchema,
        body: advanceTestClockSchema,
        response: { 200: testClockSchema },
      },
    },
    async (request, reply) => {
      const clock = await fastify.testClockService.advanceTestClock(
        request.params.testClockId,
        request.body,
      );

      return ApiResponse.success(reply, clock);
    },
  );
};
