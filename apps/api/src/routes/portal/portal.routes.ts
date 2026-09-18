import { verifyPortalKeyRequest } from '@hooks/verify-portal-key-request';
import { verifyPortalSessionRequest } from '@hooks/verify-portal-session-request';
import { portalAccountRoutes } from '@routes/portal/account/account.routes';
import { portalSessionsRoutes } from '@routes/portal/sessions/sessions.routes';
import type { FastifyInstance } from 'fastify';

export async function portalRoutes(fastify: FastifyInstance): Promise<void> {
  await fastify.register(async (scope) => {
    scope.addHook('preHandler', verifyPortalKeyRequest);

    await scope.register(portalSessionsRoutes);
  });

  await fastify.register(async (scope) => {
    scope.addHook('preHandler', verifyPortalSessionRequest);

    await scope.register(portalAccountRoutes);
  });
}
