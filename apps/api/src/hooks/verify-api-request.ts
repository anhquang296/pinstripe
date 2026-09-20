import { authenticateRequest } from '@hooks/authenticate-request';
import { authorizeRequest } from '@hooks/authorize-request';
import type { FastifyReply, FastifyRequest } from 'fastify';

export async function verifyApiRequest(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  await authenticateRequest(request, reply);

  authorizeRequest(request);
}
