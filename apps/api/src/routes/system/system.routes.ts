import { verifySystemRequest } from '@hooks/verify-system-request';
import { pspCallbacksRoutes } from '@routes/system/psp-callbacks/psp-callbacks.routes';
import { Type } from '@sinclair/typebox';
import { ApiResponse } from '@utils/api-response';
import type { FastifyInstance } from 'fastify';

export async function systemRoutes(fastify: FastifyInstance): Promise<void> {
  await fastify.register(pspCallbacksRoutes, { prefix: '/psp' });

  await fastify.register(async (scope) => {
    scope.addHook('preHandler', verifySystemRequest);

    scope.get(
      '/ping',
      { schema: { response: { 200: Type.Object({ now: Type.String() }) } } },
      async (_request, reply) => {
        return ApiResponse.success(reply, { now: fastify.clock.now().toISOString() });
      },
    );
  });
}
