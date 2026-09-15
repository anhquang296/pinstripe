import { Type } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import { verifyManagementRequest } from '@hooks/verify-management-request';

const RELAY_BATCH_SIZE = 100;

export async function managementRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', verifyManagementRequest);

  fastify.post(
    '/outbox/relay',
    { schema: { response: { 200: Type.Object({ relayed: Type.Integer() }) } } },
    async () => {
      const relayed = await fastify.outboxService.relayOutboxEvents(RELAY_BATCH_SIZE);

      return { relayed };
    },
  );
}
