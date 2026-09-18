import type { UserRole } from '@pinstripe/core/contracts';
import {
  ApiKeyScopeEnum,
  LedgerAccountCodeEnum,
  PostingDirectionEnum,
  UserRoleEnum,
  UserStatusEnum,
} from '@pinstripe/core/contracts';
import { CurrencyEnum, generateGid, ObjectPrefixEnum } from '@pinstripe/core/utils';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';
import { afterAll, beforeAll, expect, it } from 'vitest';

import { buildAuthHeaders, buildTestApp, mintApiKey } from './context';

interface InjectedCookie {
  name: string;
  value: string;
}

const AUTH_PATH = '/api/v1/auth';
const SESSION_COOKIE_PREFIX = 'pinstripe';
const PASSWORD = 'correct horse battery staple';

let fastify: FastifyInstance;

beforeAll(async () => {
  fastify = await buildTestApp();
});

afterAll(async () => {
  await fastify.close();
});

function makeCustomerPayload() {
  return {
    email: `${generateGid(ObjectPrefixEnum.CUSTOMER)}@session-authorization.test`,
    currency: CurrencyEnum.VND,
  };
}

function makeLedgerTransactionPayload() {
  return {
    description: 'session authorization probe',
    currency: CurrencyEnum.VND,
    entries: [
      {
        accountCode: LedgerAccountCodeEnum.CASH,
        direction: PostingDirectionEnum.DEBIT,
        amount: 1000,
      },
      {
        accountCode: LedgerAccountCodeEnum.REVENUE,
        direction: PostingDirectionEnum.CREDIT,
        amount: 1000,
      },
    ],
  };
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
  const email = `${generateGid(ObjectPrefixEnum.USER)}@session-authorization.test`;
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

it('still lets an api key call both surfaces', async () => {
  const apiKey = await mintApiKey(fastify, [ApiKeyScopeEnum.V1]);
  const adminKey = await mintApiKey(fastify, [ApiKeyScopeEnum.ADMIN]);

  const v1Response = await fastify.inject({
    method: 'GET',
    url: '/v1/customers',
    headers: buildAuthHeaders(apiKey.token),
  });
  const adminResponse = await fastify.inject({
    method: 'GET',
    url: '/api/v1/admin/ledger/accounts',
    headers: buildAuthHeaders(adminKey.token),
  });

  expect(v1Response.statusCode).toBe(200);
  expect(adminResponse.statusCode).toBe(200);
});

it('lets a member session read customers', async () => {
  const { cookie } = await signIn(UserRoleEnum.MEMBER);

  const response = await fastify.inject({
    method: 'GET',
    url: '/v1/customers',
    headers: buildSessionHeaders(cookie),
  });

  expect(response.statusCode).toBe(200);
});

it('refuses a member session that tries to create a customer', async () => {
  const { cookie } = await signIn(UserRoleEnum.MEMBER);

  const response = await fastify.inject({
    method: 'POST',
    url: '/v1/customers',
    headers: buildSessionHeaders(cookie),
    payload: makeCustomerPayload(),
  });

  expect(response.statusCode).toBe(403);
});

it('lets a moderator session create a customer', async () => {
  const { cookie } = await signIn(UserRoleEnum.MODERATOR);

  const response = await fastify.inject({
    method: 'POST',
    url: '/v1/customers',
    headers: buildSessionHeaders(cookie),
    payload: makeCustomerPayload(),
  });

  expect(response.statusCode).toBe(201);
});

it('refuses a moderator session that tries to post a ledger transaction', async () => {
  const { cookie } = await signIn(UserRoleEnum.MODERATOR);

  const response = await fastify.inject({
    method: 'POST',
    url: '/api/v1/admin/ledger/transactions',
    headers: buildSessionHeaders(cookie),
    payload: makeLedgerTransactionPayload(),
  });

  expect(response.statusCode).toBe(403);
});

it('lets an admin session post a ledger transaction', async () => {
  const { cookie } = await signIn(UserRoleEnum.ADMIN);

  const response = await fastify.inject({
    method: 'POST',
    url: '/api/v1/admin/ledger/transactions',
    headers: buildSessionHeaders(cookie),
    payload: makeLedgerTransactionPayload(),
  });

  expect(response.statusCode).toBe(201);
});

it('lets an admin session reach an admin route', async () => {
  const { cookie } = await signIn(UserRoleEnum.ADMIN);

  const response = await fastify.inject({
    method: 'GET',
    url: '/api/v1/admin/api_keys',
    headers: buildSessionHeaders(cookie),
  });

  expect(response.statusCode).toBe(200);
});

it('answers 401 when the request carries no session and no api key', async () => {
  const response = await fastify.inject({ method: 'GET', url: '/v1/customers' });

  expect(response.statusCode).toBe(401);
});

it('answers 401 once the user behind the session is banned', async () => {
  const { userId, cookie } = await signIn(UserRoleEnum.MEMBER);

  await fastify.userService.updateUser(userId, { status: UserStatusEnum.DISABLED });

  const response = await fastify.inject({
    method: 'GET',
    url: '/v1/customers',
    headers: buildSessionHeaders(cookie),
  });

  expect(response.statusCode).toBe(401);
});

it('answers 403 for a session write whose Origin is not the dashboard', async () => {
  const { cookie } = await signIn(UserRoleEnum.MODERATOR);

  const response = await fastify.inject({
    method: 'POST',
    url: '/v1/customers',
    headers: { cookie, origin: 'https://attacker.test' },
    payload: makeCustomerPayload(),
  });

  expect(response.statusCode).toBe(403);
});

it('refuses a session cookie on the management surface', async () => {
  const { cookie } = await signIn(UserRoleEnum.ADMIN);

  const response = await fastify.inject({
    method: 'POST',
    url: '/api/v1/management/users/bootstrap',
    headers: buildSessionHeaders(cookie),
    payload: {
      email: `${generateGid(ObjectPrefixEnum.USER)}@session-authorization.test`,
      name: 'Smuggled Admin',
      password: PASSWORD,
    },
  });

  expect(response.statusCode).toBe(401);
});
