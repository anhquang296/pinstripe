import type { UserRole } from '@vxrerp/platform/contracts';
import { UserRoleEnum, UserStatusEnum } from '@vxrerp/platform/contracts';
import { generateGid, ObjectPrefixEnum } from '@vxrerp/platform/utils';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';
import { afterAll, beforeAll, expect, it } from 'vitest';

import { ALL_PERMISSIONS, buildAuthHeaders, buildTestApp, mintApiKey } from './context';

interface InjectedCookie {
  name: string;
  value: string;
}

const AUTH_PATH = '/v1/auth';
const USERS_PATH = '/v1/users';
const ACCOUNT_PATH = '/v1/account';
const SESSION_COOKIE_PREFIX = 'vxrerp';
const PASSWORD = 'correct horse battery staple';

let fastify: FastifyInstance;

beforeAll(async () => {
  fastify = await buildTestApp();
});

afterAll(async () => {
  await fastify.close();
});

function makeEmail(): string {
  return `${generateGid(ObjectPrefixEnum.USER)}@admin-users.test`;
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

async function signIn(role: UserRole): Promise<{ userId: string; cookie: string }> {
  const email = makeEmail();

  const user = await fastify.userService.createUser({
    email,
    name: 'Dashboard Operator',
    role,
    password: PASSWORD,
  });

  const response = await fastify.inject({
    method: 'POST',
    url: `${AUTH_PATH}/sign-in/email`,
    headers: { origin: fastify.betterAuth.baseUrl },
    payload: { email, password: PASSWORD },
  });

  return { userId: user.id, cookie: readSessionCookie(response.cookies) };
}

function buildSessionHeaders(cookie: string): Record<string, string> {
  return { cookie, origin: fastify.betterAuth.baseUrl };
}

const ACTIVE_ADMIN_SCAN_LIMIT = 500;

async function banOtherActiveAdmins(keptUserId: string): Promise<string[]> {
  const admins = await fastify.userRepository.findUsers(
    { role: UserRoleEnum.ADMIN, banned: false },
    ACTIVE_ADMIN_SCAN_LIMIT,
  );

  const bannedAdminIds = _(admins)
    .map('id')
    .reject((id) => {
      return id === keptUserId;
    })
    .value();

  for (const adminId of bannedAdminIds) {
    await fastify.betterAuth.updateUser(adminId, { banned: true });
  }

  return bannedAdminIds;
}

async function restoreAdmins(adminIds: string[]): Promise<void> {
  for (const adminId of adminIds) {
    await fastify.betterAuth.updateUser(adminId, { banned: false });
  }
}

it('creates a user through the admin surface', async () => {
  const { cookie } = await signIn(UserRoleEnum.ADMIN);

  const response = await fastify.inject({
    method: 'POST',
    url: USERS_PATH,
    headers: buildSessionHeaders(cookie),
    payload: { email: makeEmail(), name: 'Created Operator', role: UserRoleEnum.MEMBER },
  });

  expect(response.statusCode).toBe(201);
  expect(response.json()).toMatchObject({
    role: UserRoleEnum.MEMBER,
    status: UserStatusEnum.ACTIVE,
  });
});

it('lists and reads back a created user', async () => {
  const { cookie } = await signIn(UserRoleEnum.ADMIN);

  const created = await fastify.userService.createUser({
    email: makeEmail(),
    name: 'Listed Operator',
    role: UserRoleEnum.MEMBER,
  });

  const findResponse = await fastify.inject({
    method: 'GET',
    url: `${USERS_PATH}?role=${UserRoleEnum.MEMBER}`,
    headers: buildSessionHeaders(cookie),
  });

  const getResponse = await fastify.inject({
    method: 'GET',
    url: `${USERS_PATH}/${created.id}`,
    headers: buildSessionHeaders(cookie),
  });

  expect(findResponse.statusCode).toBe(200);
  expect(findResponse.json()).toMatchObject({ url: USERS_PATH });
  expect(getResponse.json()).toMatchObject({ id: created.id, name: 'Listed Operator' });
});

it('refuses to demote the last active admin', async () => {
  const { userId, cookie } = await signIn(UserRoleEnum.ADMIN);

  const bannedAdminIds = await banOtherActiveAdmins(userId);

  const response = await fastify.inject({
    method: 'PATCH',
    url: `${USERS_PATH}/${userId}`,
    headers: buildSessionHeaders(cookie),
    payload: { role: UserRoleEnum.MEMBER },
  });

  await restoreAdmins(bannedAdminIds);

  expect(response.statusCode).toBe(409);
});

it('demotes an admin while another active admin remains', async () => {
  const { cookie } = await signIn(UserRoleEnum.ADMIN);

  const spareAdmin = await fastify.userService.createUser({
    email: makeEmail(),
    name: 'Spare Admin',
    role: UserRoleEnum.ADMIN,
  });

  const response = await fastify.inject({
    method: 'PATCH',
    url: `${USERS_PATH}/${spareAdmin.id}`,
    headers: buildSessionHeaders(cookie),
    payload: { role: UserRoleEnum.MEMBER },
  });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toMatchObject({ id: spareAdmin.id, role: UserRoleEnum.MEMBER });
});

it('revokes the sessions of a user whose role changes', async () => {
  const { cookie: adminCookie } = await signIn(UserRoleEnum.ADMIN);

  const { userId, cookie: memberCookie } = await signIn(UserRoleEnum.MEMBER);

  const patchResponse = await fastify.inject({
    method: 'PATCH',
    url: `${USERS_PATH}/${userId}`,
    headers: buildSessionHeaders(adminCookie),
    payload: { role: UserRoleEnum.MODERATOR },
  });

  const revokedResponse = await fastify.inject({
    method: 'GET',
    url: '/v1/customers',
    headers: buildSessionHeaders(memberCookie),
  });

  expect(patchResponse.json()).toMatchObject({ role: UserRoleEnum.MODERATOR });
  expect(revokedResponse.statusCode).toBe(401);
});

it('refuses a member session on the users route', async () => {
  const { cookie } = await signIn(UserRoleEnum.MEMBER);

  const response = await fastify.inject({
    method: 'GET',
    url: USERS_PATH,
    headers: buildSessionHeaders(cookie),
  });

  expect(response.statusCode).toBe(403);
});

it('answers the account of the signed-in session', async () => {
  const { userId, cookie } = await signIn(UserRoleEnum.MODERATOR);

  const response = await fastify.inject({
    method: 'GET',
    url: ACCOUNT_PATH,
    headers: buildSessionHeaders(cookie),
  });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toMatchObject({
    user: { id: userId, role: UserRoleEnum.MODERATOR },
    permissions: expect.arrayContaining(['billing.read']),
  });
});

it('refuses the account route to an api key', async () => {
  const adminKey = await mintApiKey(fastify, ALL_PERMISSIONS);

  const response = await fastify.inject({
    method: 'GET',
    url: ACCOUNT_PATH,
    headers: buildAuthHeaders(adminKey.token),
  });

  expect(response.statusCode).toBe(403);
});
