import { verifyManagementRequest } from '@hooks/verify-management-request';
import { Type } from '@sinclair/typebox';
import { ApiResponse } from '@utils/api-response';
import type { FastifyInstance } from 'fastify';

const RELAY_BATCH_SIZE = 100;

export async function managementRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', verifyManagementRequest);

  fastify.post(
    '/outbox/relay',
    { schema: { response: { 200: Type.Object({ relayed: Type.Integer() }) } } },
    async (_request, reply) => {
      const relayed = await fastify.outboxService.relayOutboxEvents(RELAY_BATCH_SIZE);

      return ApiResponse.success(reply, { relayed });
    },
  );
}
