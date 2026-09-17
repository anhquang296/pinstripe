import type { RequestAuth } from '@pinstripe/core/contracts';
import { UnauthorizedError } from '@pinstripe/core/errors';
import type { FastifyRequest } from 'fastify';

export function readAuth(request: FastifyRequest): RequestAuth {
  const { auth } = request;

  if (auth) {
    return auth;
  }

  throw new UnauthorizedError('This route was reached without an authenticated API key');
}

export function readLivemode(request: FastifyRequest): boolean {
  return readAuth(request).livemode;
}
