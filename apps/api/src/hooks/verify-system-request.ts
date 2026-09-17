import { authenticateRequest } from '@hooks/authenticate-request';
import { ApiKeyScopeEnum } from '@pinstripe/core/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';

export async function verifySystemRequest(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  await authenticateRequest(request, ApiKeyScopeEnum.SYSTEM);
}
