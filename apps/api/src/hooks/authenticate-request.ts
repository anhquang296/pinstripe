import type { ApiKeyScope } from '@pinstripe/core/contracts';
import { ForbiddenError, UnauthorizedError } from '@pinstripe/core/errors';
import { ApiKeyService } from '@pinstripe/core/services';
import type { FastifyRequest } from 'fastify';
import _ from 'lodash';

const BEARER_PREFIX = 'Bearer ';

export function readBearerToken(request: FastifyRequest): string {
  const header = request.headers.authorization;

  if (header && _.startsWith(header, BEARER_PREFIX)) {
    return header.slice(BEARER_PREFIX.length).trim();
  }

  throw new UnauthorizedError('Missing bearer token in Authorization header');
}

export async function authenticateRequest(
  request: FastifyRequest,
  scope: ApiKeyScope,
): Promise<void> {
  const token = readBearerToken(request);
  const auth = await request.server.apiKeyService.authenticateApiKey(token);

  if (ApiKeyService.hasScope(auth, scope)) {
    request.auth = auth;

    return;
  }

  throw new ForbiddenError(`This API key is not permitted to call the ${scope} surface`);
}
