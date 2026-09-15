import type { FastifyReply, FastifyRequest } from 'fastify';
import { UnauthorizedError } from '@pinstripe/core/errors';
import { matchesSecret, readBearerToken } from '@hooks/verify-api-request';

export async function verifyManagementRequest(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const token = readBearerToken(request);

  if (!matchesSecret(token, request.server.apiKeys.management)) {
    throw new UnauthorizedError('Invalid management API key provided');
  }
}
