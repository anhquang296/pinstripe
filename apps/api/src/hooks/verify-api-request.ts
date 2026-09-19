import { authenticateRequest } from '@hooks/authenticate-request';
import { authorizeRequest } from '@hooks/authorize-request';
import { ApiKeyScopeEnum } from '@pinstripe/core/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';

export async function verifyApiRequest(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  await authenticateRequest(request, reply, ApiKeyScopeEnum.V1);

  authorizeRequest(request);
}
