import { UserRoleEnum } from '@pinstripe/core/contracts';
import { adminSessions } from '@pinstripe/core/database';
import { generateGid, ObjectPrefixEnum } from '@pinstripe/core/utils';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildAuthHeaders, buildTestApp } from './context';

interface AuthRequestOptions {
  method: 'GET' | 'POST';
  url: string;
  payload?: Record<string, unknown>;
  headers?: Record<string, string>;
}

interface InjectedCookie {
  name: string;
  value: string;
}

const AUTH_PATH = '/api/v1/auth';
const SESSION_COOKIE_PREFIX = 'pinstripe';
const PASSWORD = 'correct horse battery staple';
const MS_PER_HOUR = 3_600_000;
const MS_PER_MINUTE = 60_000;

let fastify: FastifyInstance;

beforeAll(async () => {
  fastify = await buildTestApp();
});

afterAll(async () => {
  await fastify.close();
});

async function makeUser() {
  const email = `${generateGid(ObjectPrefixEnum.USER)}@auth-routes.test`;

  return fastify.userService.createUser({
    email,
    name: 'Dashboard Tester',
    role: UserRoleEnum.MEMBER,
    password: PASSWORD,
  });
}

function callAuth({ method, url, payload, headers = {} }: AuthRequestOptions) {
  return fastify.inject({
    method,
    url: `${AUTH_PATH}${url}`,
    payload,
    headers: { origin: fastify.betterAuth.baseUrl, ...headers },
  });
}

function readSessionCookie(cookies: InjectedCookie[]): string {
  const sessionCookie = _.find(cookies, (cookie) => {
    return _.startsWith(cookie.name, SESSION_COOKIE_PREFIX);
  });

  if (sessionCookie) {
    return `${sessionCookie.name}=${sessionCookie.value}`;
  }

  throw new Error('test fixture could not read a session cookie');
}

async function signIn(email: string): Promise<string> {
  const response = await callAuth({
    method: 'POST',
    url: '/sign-in/email',
    payload: { email, password: PASSWORD },
  });

  return readSessionCookie(response.cookies);
}

describe('allowlist', () => {
  it('answers 404 for a better-auth path that is not on the allowlist', async () => {
    const response = await callAuth({ method: 'GET', url: '/list-sessions' });

    expect(response.statusCode).toBe(404);
  });

  it('answers 404 for the admin plugin path', async () => {
    const response = await callAuth({ method: 'GET', url: '/admin/list-users' });

    expect(response.statusCode).toBe(404);
  });

  it('answers 404 for sign up', async () => {
    const response = await callAuth({
      method: 'POST',
      url: '/sign-up/email',
      payload: { email: 'intruder@auth-routes.test', password: PASSWORD, name: 'Intruder' },
    });

    expect(response.statusCode).toBe(404);
  });
});

describe('origin check', () => {
  it('refuses a POST whose Origin is not the dashboard', async () => {
    const user = await makeUser();

    const response = await callAuth({
      method: 'POST',
      url: '/sign-in/email',
      payload: { email: user.email, password: PASSWORD },
      headers: { origin: 'https://attacker.test' },
    });

    expect(response.statusCode).toBe(403);
  });

  it('allows a GET that carries no Origin, the way the social callback arrives', async () => {
    const response = await fastify.inject({ method: 'GET', url: `${AUTH_PATH}/get-session` });

    expect(response.statusCode).toBe(200);
  });
});

describe('sign in', () => {
  it('sets a session cookie and keeps the session token out of the body', async () => {
    const user = await makeUser();

    const response = await callAuth({
      method: 'POST',
      url: '/sign-in/email',
      payload: { email: user.email, password: PASSWORD },
    });

    expect(response.statusCode).toBe(200);
    expect(readSessionCookie(response.cookies)).toContain(SESSION_COOKIE_PREFIX);
    expect(response.json()).not.toHaveProperty('token');
    expect(response.json().user.email).toBe(user.email);
  });

  it('answers 401 carrying the better-auth code when the password is wrong', async () => {
    const user = await makeUser();

    const response = await callAuth({
      method: 'POST',
      url: '/sign-in/email',
      payload: { email: user.email, password: 'wrong password entirely' },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('INVALID_EMAIL_OR_PASSWORD');
  });
});

describe('get session', () => {
  it('returns the better-auth shape without the session token', async () => {
    const user = await makeUser();
    const cookie = await signIn(user.email);

    const response = await callAuth({ method: 'GET', url: '/get-session', headers: { cookie } });
    const account = response.json();

    expect(account.user.id).toBe(user.id);
    expect(account.session.id).toEqual(expect.any(String));
    expect(account.session).not.toHaveProperty('token');
  });

  it('returns null when no session cookie is sent', async () => {
    const response = await callAuth({ method: 'GET', url: '/get-session' });

    expect(response.json()).toBeNull();
  });

  it('returns null once the session passes the absolute ttl', async () => {
    const user = await makeUser();
    const cookie = await signIn(user.email);
    const { ADMIN_SESSION_ABSOLUTE_TTL_HOURS } = fastify.config;
    const createdAt = new Date(Date.now() - (ADMIN_SESSION_ABSOLUTE_TTL_HOURS + 1) * MS_PER_HOUR);

    await fastify.database.master
      .update(adminSessions)
      .set({ createdAt })
      .where(eq(adminSessions.userId, user.id));

    const response = await callAuth({ method: 'GET', url: '/get-session', headers: { cookie } });

    expect(response.json()).toBeNull();
  });

  it('sends the refreshed session cookie once the session is due for a refresh', async () => {
    const user = await makeUser();
    const cookie = await signIn(user.email);
    const { ADMIN_SESSION_IDLE_TTL_MINUTES } = fastify.config;
    const expiresAt = new Date(Date.now() + (ADMIN_SESSION_IDLE_TTL_MINUTES - 10) * MS_PER_MINUTE);

    await fastify.database.master
      .update(adminSessions)
      .set({ expiresAt })
      .where(eq(adminSessions.userId, user.id));

    const response = await callAuth({ method: 'GET', url: '/get-session', headers: { cookie } });

    expect(response.json().user.id).toBe(user.id);
    expect(readSessionCookie(response.cookies)).toContain(SESSION_COOKIE_PREFIX);
  });
});

describe('update user', () => {
  it('refuses a field that is neither name nor image', async () => {
    const user = await makeUser();
    const cookie = await signIn(user.email);

    const response = await callAuth({
      method: 'POST',
      url: '/update-user',
      payload: { role: UserRoleEnum.ADMIN },
      headers: { cookie },
    });

    expect(response.statusCode).toBe(400);
  });

  it('accepts a name change', async () => {
    const user = await makeUser();
    const cookie = await signIn(user.email);

    const response = await callAuth({
      method: 'POST',
      url: '/update-user',
      payload: { name: 'Renamed Tester' },
      headers: { cookie },
    });

    expect(response.statusCode).toBe(200);
  });
});

describe('bootstrap admin', () => {
  it('creates the first admin once, however many times it is called', async () => {
    const { MANAGEMENT_API_KEY } = fastify.config;
    const email = `${generateGid(ObjectPrefixEnum.USER)}@bootstrap.test`;
    const options = {
      method: 'POST' as const,
      url: '/api/v1/management/users/bootstrap',
      headers: buildAuthHeaders(MANAGEMENT_API_KEY),
      payload: { email, name: 'First Admin', password: PASSWORD },
    };

    const first = await fastify.inject(options);
    const second = await fastify.inject(options);

    expect(first.statusCode).toBe(200);
    expect(first.json().role).toBe(UserRoleEnum.ADMIN);
    expect(second.json().id).toBe(first.json().id);
  });
});
