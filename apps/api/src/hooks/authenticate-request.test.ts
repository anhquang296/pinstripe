import type { Permission } from '@vxrerp/core/contracts';
import { ApiKeyTypeEnum, PermissionEnum, UserRoleEnum } from '@vxrerp/core/contracts';
import { ForbiddenError, UnauthorizedError } from '@vxrerp/core/errors';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { expect, it, vi } from 'vitest';

import { authenticateRequest } from './authenticate-request';

interface SetupOverrides {
  method?: string;
  headers?: Record<string, string>;
  authSession?: unknown;
  cookies?: string[];
  permissions?: readonly Permission[];
}

const DASHBOARD_ORIGIN = 'http://localhost:5173';
const SESSION_COOKIE = 'vxrerp.session_token=token.signature';

function makeAuthSession(overrides: { role?: string; banned?: boolean } = {}) {
  const { role = UserRoleEnum.MEMBER, banned = false } = overrides;

  return {
    user: { id: 'usr_1', role, banned },
    session: { id: 'ases_1' },
  };
}

function setup(overrides: SetupOverrides = {}) {
  const {
    method = 'GET',
    headers = {},
    authSession = makeAuthSession(),
    cookies = [],
    permissions = [PermissionEnum.BILLING_READ],
  } = overrides;

  const findActiveSession = vi.fn().mockResolvedValue({ authSession, cookies });

  const authenticateApiKey = vi
    .fn()
    .mockResolvedValue({ apiKeyId: 'key_1', type: ApiKeyTypeEnum.SECRET, permissions });

  const request = {
    method,
    headers,
    server: {
      betterAuth: { baseUrl: DASHBOARD_ORIGIN, findActiveSession },
      apiKeyService: { authenticateApiKey },
    },
  } as unknown as FastifyRequest;

  const header = vi.fn();
  const reply = { header } as unknown as FastifyReply;

  return { request, reply, header, findActiveSession, authenticateApiKey };
}

it('authenticates an api key when the request carries a bearer token', async () => {
  const { request, reply, findActiveSession } = setup({
    headers: { authorization: 'Bearer sk_live_1' },
  });

  await authenticateRequest(request, reply);

  expect(request.auth?.apiKeyId).toBe('key_1');
  expect(request.auth?.permissions).toEqual([PermissionEnum.BILLING_READ]);
  expect(request.actor).toBeUndefined();
  expect(findActiveSession).not.toHaveBeenCalled();
});

it('throws UnauthorizedError when the request carries neither a bearer token nor a session', async () => {
  const { request, reply } = setup();

  await expect(authenticateRequest(request, reply)).rejects.toThrow(UnauthorizedError);
});

it('builds an actor from the session cookie of a GET request', async () => {
  const { request, reply, header } = setup({ headers: { cookie: SESSION_COOKIE } });

  await authenticateRequest(request, reply);

  expect(request.actor?.userId).toBe('usr_1');
  expect(request.actor?.role).toBe(UserRoleEnum.MEMBER);
  expect(request.actor?.permissions).toEqual([PermissionEnum.BILLING_READ]);
  expect(request.auth).toBeUndefined();
  expect(header).not.toHaveBeenCalled();
});

it('sets the refreshed session cookie on the reply when the session is refreshed', async () => {
  const refreshedCookie = 'vxrerp.session_token=token.signature; Max-Age=3600; Path=/';

  const { request, reply, header } = setup({
    headers: { cookie: SESSION_COOKIE },
    cookies: [refreshedCookie],
  });

  await authenticateRequest(request, reply);

  expect(header).toHaveBeenCalledWith('set-cookie', [refreshedCookie]);
});

it('accepts a POST by session when the Origin is the dashboard', async () => {
  const { request, reply } = setup({
    method: 'POST',
    headers: { cookie: SESSION_COOKIE, origin: DASHBOARD_ORIGIN },
    authSession: makeAuthSession({ role: UserRoleEnum.MODERATOR }),
  });

  await authenticateRequest(request, reply);

  expect(request.actor?.role).toBe(UserRoleEnum.MODERATOR);
});

it('throws ForbiddenError for a POST by session whose Origin is not the dashboard', async () => {
  const { request, reply } = setup({
    method: 'POST',
    headers: { cookie: SESSION_COOKIE, origin: 'https://attacker.test' },
  });

  await expect(authenticateRequest(request, reply)).rejects.toThrow(ForbiddenError);
});

it('throws UnauthorizedError when the session is gone or past the absolute ttl', async () => {
  const { request, reply } = setup({ headers: { cookie: SESSION_COOKIE }, authSession: null });

  await expect(authenticateRequest(request, reply)).rejects.toThrow(UnauthorizedError);
});

it('throws UnauthorizedError when the session belongs to a banned user', async () => {
  const { request, reply } = setup({
    headers: { cookie: SESSION_COOKIE },
    authSession: makeAuthSession({ banned: true }),
  });

  await expect(authenticateRequest(request, reply)).rejects.toThrow(UnauthorizedError);
});

it('throws UnauthorizedError when the session carries a role the repository does not know', async () => {
  const { request, reply } = setup({
    headers: { cookie: SESSION_COOKIE },
    authSession: makeAuthSession({ role: 'superuser' }),
  });

  await expect(authenticateRequest(request, reply)).rejects.toThrow(UnauthorizedError);
});

it('prefers the bearer token when the request carries a session cookie as well', async () => {
  const { request, reply, findActiveSession } = setup({
    headers: { authorization: 'Bearer sk_live_1', cookie: SESSION_COOKIE },
  });

  await authenticateRequest(request, reply);

  expect(request.auth?.apiKeyId).toBe('key_1');
  expect(request.actor).toBeUndefined();
  expect(findActiveSession).not.toHaveBeenCalled();
});
