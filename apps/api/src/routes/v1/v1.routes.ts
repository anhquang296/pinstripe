import { Type } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import { verifyApiRequest } from '@hooks/verify-api-request';
import { idempotencyHook } from '@hooks/idempotency.hook';

export async function v1Routes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', verifyApiRequest);

  await fastify.register(idempotencyHook);

  fastify.get(
    '/ping',
    { schema: { response: { 200: Type.Object({ object: Type.String(), now: Type.String() }) } } },
    async () => {
      return { object: 'ping', now: fastify.clock.now().toISOString() };
    },
  );
}
