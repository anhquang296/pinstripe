import { PORTAL_SESSION_COOKIE } from '@common/constants/portal-session';
import { handlePortalBffRequest } from '@libs/portal-bff';
import { NextRequest } from 'next/server';
import { afterEach, expect, it, vi } from 'vitest';

const PORTAL_ORIGIN = 'http://portal.test';
const PORTAL_API_KEY = 'pk_portal_test_key_value';

interface RequestOverrides {
  headers?: Record<string, string>;
  body?: unknown;
  sessionKey?: string;
}

function buildRequest(method: string, path: string, overrides: RequestOverrides = {}) {
  const { headers = {}, body, sessionKey } = overrides;
  const requestHeaders = new Headers({ host: 'portal.test', ...headers });

  if (sessionKey) {
    requestHeaders.set('cookie', `${PORTAL_SESSION_COOKIE}=${sessionKey}`);
  }

  return new NextRequest(`${PORTAL_ORIGIN}/bff/portal/${path}`, {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function setup(apiResponse: Response = Response.json({})) {
  const fetchMock = vi.fn().mockResolvedValue(apiResponse);

  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('PINSTRIPE_API_URL', 'http://api.test');
  vi.stubEnv('PINSTRIPE_PORTAL_API_KEY', PORTAL_API_KEY);

  return { fetchMock };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it('refuses a path outside the allowlist without calling the API', async () => {
  const { fetchMock } = setup();

  const response = await handlePortalBffRequest(buildRequest('GET', 'admin/users'), [
    'admin',
    'users',
  ]);

  expect(response.status).toBe(404);
  expect(fetchMock).not.toHaveBeenCalled();
});

it('refuses a mutating request whose origin is not the portal', async () => {
  const { fetchMock } = setup();
  const request = buildRequest('POST', 'links', {
    headers: { origin: 'http://attacker.test' },
    body: { email: 'ketoan@nhaxe.vn' },
  });

  const response = await handlePortalBffRequest(request, ['links']);

  expect(response.status).toBe(403);
  expect(fetchMock).not.toHaveBeenCalled();
});

it('sends a link request with the portal key and the end-user address', async () => {
  const { fetchMock } = setup(Response.json({ linkExpiresAt: '2026-09-19T08:00:00.000Z' }));
  const request = buildRequest('POST', 'links', {
    headers: { origin: PORTAL_ORIGIN, 'x-forwarded-for': '203.0.113.7, 10.0.0.1' },
    body: { email: 'ketoan@nhaxe.vn' },
  });

  const response = await handlePortalBffRequest(request, ['links']);

  expect(response.status).toBe(200);
  expect(fetchMock).toHaveBeenCalledWith(
    'http://api.test/portal/links',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ email: 'ketoan@nhaxe.vn' }),
      headers: expect.objectContaining({
        authorization: `Bearer ${PORTAL_API_KEY}`,
        'x-pinstripe-client-ip': '203.0.113.7',
      }),
    }),
  );
});

it('keeps the session key in an httpOnly cookie and out of the response body', async () => {
  setup(
    Response.json(
      {
        id: 'ps_1',
        customerId: 'cus_1',
        status: 'active',
        sessionKey: 'raw-session-key',
        sessionExpiresAt: '2026-09-19T09:00:00.000Z',
      },
      { status: 201 },
    ),
  );
  const request = buildRequest('POST', 'sessions', {
    headers: { origin: PORTAL_ORIGIN },
    body: { linkKey: 'one-time-link-key-value' },
  });

  const response = await handlePortalBffRequest(request, ['sessions']);
  const sessionCookie = response.cookies.get(PORTAL_SESSION_COOKIE);

  expect(response.status).toBe(201);
  expect((await response.json()).sessionKey).toBeNull();
  expect(sessionCookie).toMatchObject({
    value: 'raw-session-key',
    httpOnly: true,
    sameSite: 'lax',
  });
});

it('reads account data with the session cookie, never with the portal key', async () => {
  const { fetchMock } = setup(Response.json({ customerId: 'cus_1' }));

  await handlePortalBffRequest(buildRequest('GET', 'me', { sessionKey: 'raw-session-key' }), [
    'me',
  ]);

  expect(fetchMock).toHaveBeenCalledWith(
    'http://api.test/portal/me',
    expect.objectContaining({
      headers: { accept: 'application/json', authorization: 'Bearer raw-session-key' },
    }),
  );
});

it('drops the session cookie when the API no longer accepts the session', async () => {
  setup(Response.json({ error: { type: 'authentication_error' } }, { status: 401 }));

  const response = await handlePortalBffRequest(
    buildRequest('GET', 'me', { sessionKey: 'expired-session-key' }),
    ['me'],
  );

  expect(response.status).toBe(401);
  expect(response.cookies.get(PORTAL_SESSION_COOKIE)).toMatchObject({ value: '' });
});

it('drops the session cookie once the customer signs out', async () => {
  setup(Response.json({ id: 'ps_1', status: 'revoked' }));
  const request = buildRequest('DELETE', 'sessions', {
    headers: { origin: PORTAL_ORIGIN },
    sessionKey: 'raw-session-key',
  });

  const response = await handlePortalBffRequest(request, ['sessions']);

  expect(response.status).toBe(200);
  expect(response.cookies.get(PORTAL_SESSION_COOKIE)).toMatchObject({ value: '' });
});

it('answers 503 when the portal key is not configured', async () => {
  const { fetchMock } = setup();

  vi.stubEnv('PINSTRIPE_PORTAL_API_KEY', '');

  const response = await handlePortalBffRequest(buildRequest('GET', 'me'), ['me']);

  expect(response.status).toBe(503);
  expect(fetchMock).not.toHaveBeenCalled();
});
