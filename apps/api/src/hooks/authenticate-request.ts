import type { ApiKeyScope, UserAuth, UserRole } from '@pinstripe/core/contracts';
import { ApiKeyScopeEnum, ROLE_PERMISSIONS, UserRoleEnum } from '@pinstripe/core/contracts';
import { ForbiddenError, UnauthorizedError } from '@pinstripe/core/errors';
import { ApiKeyService } from '@pinstripe/core/services';
import type { FastifyRequest } from 'fastify';
import _ from 'lodash';

const BEARER_PREFIX = 'Bearer ';
const SESSION_COOKIE_PREFIX = 'pinstripe.';
const SESSION_SCOPES = [ApiKeyScopeEnum.V1, ApiKeyScopeEnum.ADMIN];
const USER_ROLES: Record<string, UserRole> = {
  [UserRoleEnum.ADMIN]: UserRoleEnum.ADMIN,
  [UserRoleEnum.MODERATOR]: UserRoleEnum.MODERATOR,
  [UserRoleEnum.MEMBER]: UserRoleEnum.MEMBER,
};

export function findBearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;

  if (header && _.startsWith(header, BEARER_PREFIX)) {
    return header.slice(BEARER_PREFIX.length).trim();
  }

  return null;
}

export function readBearerToken(request: FastifyRequest): string {
  const token = findBearerToken(request);

  if (token) {
    return token;
  }

  throw new UnauthorizedError('Missing bearer token in Authorization header');
}

function hasSessionCookie(request: FastifyRequest, scope: ApiKeyScope): boolean {
  const { cookie = '' } = request.headers;

  return _.includes(SESSION_SCOPES, scope) && _.includes(cookie, SESSION_COOKIE_PREFIX);
}

function buildSessionHeaders(request: FastifyRequest): Headers {
  const headers = new Headers();
  const { cookie } = request.headers;

  if (cookie) {
    headers.set('cookie', cookie);
  }

  return headers;
}

function assertTrustedOrigin(request: FastifyRequest): void {
  const isReadRequest = request.method === 'GET';

  if (isReadRequest || request.headers.origin === request.server.betterAuth.baseUrl) {
    return;
  }

  throw new ForbiddenError('This request came from an origin the dashboard does not trust');
}

async function readSessionActor(request: FastifyRequest): Promise<UserAuth> {
  const authSession = await request.server.betterAuth.findActiveSession(
    buildSessionHeaders(request),
  );
  const user = _.get(authSession, 'user');
  const session = _.get(authSession, 'session');
  const userRole = _.get(authSession, 'user.role', '');
  const role = _.get(USER_ROLES, [userRole], null);

  if (user && session && role && !user.banned) {
    return {
      userId: user.id,
      sessionId: session.id,
      role,
      permissions: ROLE_PERMISSIONS[role],
    };
  }

  throw new UnauthorizedError('This dashboard session is no longer valid; sign in again');
}

async function authenticateApiKey(request: FastifyRequest, scope: ApiKeyScope): Promise<void> {
  const token = readBearerToken(request);
  const auth = await request.server.apiKeyService.authenticateApiKey(token);

  if (ApiKeyService.hasScope(auth, scope)) {
    request.auth = auth;

    return;
  }

  throw new ForbiddenError(`This API key is not permitted to call the ${scope} surface`);
}

async function authenticateSession(request: FastifyRequest): Promise<void> {
  assertTrustedOrigin(request);

  request.actor = await readSessionActor(request);
}

export async function authenticateRequest(
  request: FastifyRequest,
  scope: ApiKeyScope,
): Promise<void> {
  if (findBearerToken(request)) {
    return authenticateApiKey(request, scope);
  }

  if (hasSessionCookie(request, scope)) {
    return authenticateSession(request);
  }

  throw new UnauthorizedError('Missing bearer token in Authorization header');
}
