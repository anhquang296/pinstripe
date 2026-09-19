import type { PortalAuth, RequestAuth } from '@pinstripe/core/contracts';
import { UnauthorizedError } from '@pinstripe/core/errors';
import type { FastifyRequest } from 'fastify';

export function readAuth(request: FastifyRequest): RequestAuth {
  const { auth } = request;

  if (auth) {
    return auth;
  }

  throw new UnauthorizedError('This route was reached without an authenticated API key');
}

export function readRateLimitId(request: FastifyRequest): string {
  const { actor } = request;

  if (actor) {
    return actor.userId;
  }

  const { apiKeyId } = readAuth(request);

  return apiKeyId;
}

export function readPortalAuth(request: FastifyRequest): PortalAuth {
  const { portalAuth } = request;

  if (portalAuth) {
    return portalAuth;
  }

  throw new UnauthorizedError('This route was reached without an authenticated portal session');
}
