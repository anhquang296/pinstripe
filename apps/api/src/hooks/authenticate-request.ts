import type { UserAuth, UserRole } from '@vxrerp/core/contracts';
import { ROLE_PERMISSIONS, UserRoleEnum } from '@vxrerp/core/contracts';
import { ForbiddenError, UnauthorizedError } from '@vxrerp/core/errors';
import type { FastifyReply, FastifyRequest } from 'fastify';
import _ from 'lodash';

const BEARER_PREFIX = 'Bearer ';
const SESSION_COOKIE_PREFIX = 'vxrerp.';

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

function hasSessionCookie(request: FastifyRequest): boolean {
  const { cookie = '' } = request.headers;

  return _.includes(cookie, SESSION_COOKIE_PREFIX);
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

async function readSessionActor(request: FastifyRequest, reply: FastifyReply): Promise<UserAuth> {
  const { authSession, cookies } = await request.server.betterAuth.findActiveSession(
    buildSessionHeaders(request),
  );

  if (!_.isEmpty(cookies)) {
    reply.header('set-cookie', cookies);
  }

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

export async function authenticateApiKey(request: FastifyRequest): Promise<void> {
  const token = readBearerToken(request);

  request.auth = await request.server.apiKeyService.authenticateApiKey(token);
}

async function authenticateSession(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  assertTrustedOrigin(request);

  request.actor = await readSessionActor(request, reply);
}

export async function authenticateRequest(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (findBearerToken(request)) {
    return authenticateApiKey(request);
  }

  if (hasSessionCookie(request)) {
    return authenticateSession(request, reply);
  }

  throw new UnauthorizedError('Missing bearer token in Authorization header');
}
