import { ApiKeyScopeEnum, CurrencyEnum, PortalRoleEnum } from '@pinstripe/core/contracts';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';
import { afterAll, beforeAll, expect, it } from 'vitest';

import { buildAuthHeaders, buildTestApp, mintApiKey } from './context';

let fastify: FastifyInstance;
let secretKeyHeaders: Record<string, string>;

beforeAll(async () => {
  fastify = await buildTestApp();

  const secretKey = await mintApiKey(fastify, [ApiKeyScopeEnum.V1]);

  secretKeyHeaders = buildAuthHeaders(secretKey.token);
});

afterAll(async () => {
  await fastify.close();
});

async function makeCustomer(name: string): Promise<{ id: string; email: string }> {
  const email = `${_.uniqueId('operator-')}-${Date.now()}@portal.test`;

  const customer = await fastify.customerService.createCustomer({
    email,
    currency: CurrencyEnum.VND,
    name,
  });

  return { id: customer.id, email };
}

async function signIn(email: string): Promise<Record<string, string>> {
  const link = await fastify.portalSessionService.createPortalLink({ email });

  const portalSession = await fastify.portalSessionService.redeemPortalLink({
    linkKey: String(link.linkKey),
  });

  return buildAuthHeaders(String(portalSession.sessionKey));
}

it('lets Vexere invite, re-role and remove a person on a customer portal', async () => {
  const customer = await makeCustomer('Nhà xe Quản Trị');
  const email = `${_.uniqueId('accountant-')}-${Date.now()}@portal.test`;

  const created = await fastify.inject({
    method: 'POST',
    url: '/v1/portal_memberships',
    headers: secretKeyHeaders,
    payload: { customerId: customer.id, email, name: 'Kế toán', role: PortalRoleEnum.ACCOUNTANT },
  });

  const portalMembershipId = String(created.json().id);

  const updated = await fastify.inject({
    method: 'POST',
    url: `/v1/portal_memberships/${portalMembershipId}`,
    headers: secretKeyHeaders,
    payload: { role: PortalRoleEnum.OWNER },
  });

  const listed = await fastify.inject({
    method: 'GET',
    url: `/v1/portal_memberships?customerId=${customer.id}`,
    headers: secretKeyHeaders,
  });

  const deleted = await fastify.inject({
    method: 'DELETE',
    url: `/v1/portal_memberships/${portalMembershipId}`,
    headers: secretKeyHeaders,
  });

  expect(created.statusCode).toBe(201);
  expect(created.json()).toMatchObject({ email, role: PortalRoleEnum.ACCOUNTANT });
  expect(updated.json().role).toBe(PortalRoleEnum.OWNER);
  expect(_.map(listed.json().data, 'id')).toContain(portalMembershipId);
  expect(deleted.json()).toEqual({ id: portalMembershipId, deleted: true });
});

it('answers 409 when the person already has access to that customer', async () => {
  const customer = await makeCustomer('Nhà xe Trùng');

  const payload = {
    customerId: customer.id,
    email: `${_.uniqueId('twice-')}-${Date.now()}@portal.test`,
    role: PortalRoleEnum.ACCOUNTANT,
  };

  await fastify.inject({
    method: 'POST',
    url: '/v1/portal_memberships',
    headers: secretKeyHeaders,
    payload,
  });

  const repeated = await fastify.inject({
    method: 'POST',
    url: '/v1/portal_memberships',
    headers: secretKeyHeaders,
    payload,
  });

  expect(repeated.statusCode).toBe(409);
});

it('shows a person every operator they can open and switches between them', async () => {
  const firstCustomer = await makeCustomer('Nhà xe Một');
  const secondCustomer = await makeCustomer('Nhà xe Hai');
  const strangerCustomer = await makeCustomer('Nhà xe Lạ');
  const email = `${_.uniqueId('shared-')}-${Date.now()}@portal.test`;

  for (const customer of [firstCustomer, secondCustomer]) {
    await fastify.portalUserService.createPortalMembership({
      customerId: customer.id,
      email,
      role: PortalRoleEnum.ACCOUNTANT,
    });
  }

  const headers = await signIn(email);
  const before = await fastify.inject({ method: 'GET', url: '/portal/me', headers });

  const switched = await fastify.inject({
    method: 'POST',
    url: '/portal/sessions/current',
    headers,
    payload: { customerId: secondCustomer.id },
  });

  const after = await fastify.inject({ method: 'GET', url: '/portal/me', headers });

  const refused = await fastify.inject({
    method: 'POST',
    url: '/portal/sessions/current',
    headers,
    payload: { customerId: strangerCustomer.id },
  });

  expect(before.json()).toMatchObject({
    customerId: firstCustomer.id,
    userEmail: email,
    role: PortalRoleEnum.ACCOUNTANT,
  });
  expect(_.map(before.json().memberships, 'customerName')).toEqual(['Nhà xe Một', 'Nhà xe Hai']);
  expect(switched.statusCode).toBe(200);
  expect(after.json().customerId).toBe(secondCustomer.id);
  expect(refused.statusCode).toBe(401);
});

it('refuses to remove the billing email of a customer from its own portal', async () => {
  const customer = await makeCustomer('Nhà xe Chủ');

  await signIn(customer.email);

  const listed = await fastify.inject({
    method: 'GET',
    url: `/v1/portal_memberships?customerId=${customer.id}`,
    headers: secretKeyHeaders,
  });

  const ownerMembershipId = String(_.get(listed.json(), 'data.0.id'));

  const deleted = await fastify.inject({
    method: 'DELETE',
    url: `/v1/portal_memberships/${ownerMembershipId}`,
    headers: secretKeyHeaders,
  });

  expect(deleted.statusCode).toBe(400);
});
