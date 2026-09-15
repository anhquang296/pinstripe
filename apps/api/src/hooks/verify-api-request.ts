import { timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { UnauthorizedError } from '@pinstripe/core/errors';

const BEARER_PREFIX = 'Bearer ';

export function matchesSecret(candidate: string, expected: string): boolean {
  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);

  if (candidateBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(candidateBuffer, expectedBuffer);
}

export function readBearerToken(request: FastifyRequest): string {
  const header = request.headers.authorization;

  if (!header || !header.startsWith(BEARER_PREFIX)) {
    throw new UnauthorizedError('Missing bearer token in Authorization header');
  }

  return header.slice(BEARER_PREFIX.length).trim();
}

export async function verifyApiRequest(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const token = readBearerToken(request);

  if (!matchesSecret(token, request.server.apiKeys.secret)) {
    throw new UnauthorizedError('Invalid API key provided');
  }
}
