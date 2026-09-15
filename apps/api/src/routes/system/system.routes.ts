import { verifySystemRequest } from '@hooks/verify-system-request';
import { Type } from '@sinclair/typebox';
import { ApiResponse } from '@utils/api-response';
import type { FastifyInstance } from 'fastify';

export async function systemRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', verifySystemRequest);

  fastify.get(
    '/ping',
    { schema: { response: { 200: Type.Object({ object: Type.String() }) } } },
    async (_request, reply) => {
      return ApiResponse.success(reply, { object: 'system_ping' });
    },
  );
}
