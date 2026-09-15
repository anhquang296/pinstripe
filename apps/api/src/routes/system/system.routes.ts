import { Type } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import { verifySystemRequest } from '@hooks/verify-system-request';

export async function systemRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', verifySystemRequest);

  fastify.get(
    '/ping',
    { schema: { response: { 200: Type.Object({ object: Type.String() }) } } },
    async () => {
      return { object: 'system_ping' };
    },
  );
}
