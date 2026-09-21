import { readBearerToken } from '@hooks/authenticate-request';
import type { PortalAuth } from '@vxrerp/billing/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    portalAuth?: PortalAuth;
  }
}

export async function verifyPortalSessionRequest(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const sessionKey = readBearerToken(request);

  request.portalAuth =
    await request.server.portalSessionService.authenticatePortalSession(sessionKey);
}
