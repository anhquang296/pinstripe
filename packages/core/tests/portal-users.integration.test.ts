import { PortalRoleEnum } from '@contracts/portal-memberships.types';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  UnauthorizedError,
} from '@errors/app.error';
import { CurrencyEnum } from '@utils/currency';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';
import { afterAll, beforeAll, expect, it } from 'vitest';

import { buildTestContext } from './context';

let fastify: FastifyInstance;

beforeAll(async () => {
  fastify = await buildTestContext();
});

afterAll(async () => {
  await fastify.close();
});

async function makeCustomer(): Promise<{ id: string; email: string }> {
  const email = `${generateGid(ObjectPrefixEnum.CUSTOMER)}@operator.test`;
  const customer = await fastify.customerService.createCustomer({
    email,
    currency: CurrencyEnum.VND,
    name: 'Nhà xe Portal',
  });

  return { id: customer.id, email };
}

function makeEmail(): string {
  return `${generateGid(ObjectPrefixEnum.PORTAL_USER)}@accountant.test`;
}

async function signIn(email: string) {
  const link = await fastify.portalSessionService.createPortalLink({ email });
  const portalSession = await fastify.portalSessionService.redeemPortalLink({
    linkKey: String(link.linkKey),
  });

  return fastify.portalSessionService.authenticatePortalSession(String(portalSession.sessionKey));
}

it('makes the billing email the owner of its customer the first time it signs in', async () => {
  const customer = await makeCustomer();

  const portalAuth = await signIn(customer.email);
  await signIn(customer.email);

  const memberships = await fastify.portalUserService.findPortalMemberships({
    customerId: customer.id,
  });

  expect(portalAuth).toMatchObject({ customerId: customer.id, role: PortalRoleEnum.OWNER });
  expect(memberships.data).toHaveLength(1);
});

it('lets an accountant invited by Vexere sign in with the accountant role', async () => {
  const customer = await makeCustomer();
  const email = makeEmail();

  await fastify.portalUserService.createPortalMembership({
    customerId: customer.id,
    email,
    name: 'Kế toán nhà xe',
    role: PortalRoleEnum.ACCOUNTANT,
  });

  const portalAuth = await signIn(`  ${_.toUpper(email)} `);

  expect(portalAuth).toMatchObject({ customerId: customer.id, role: PortalRoleEnum.ACCOUNTANT });
  expect(portalAuth.portalUserId).toEqual(expect.any(String));
});

it('sends no link to an address that belongs to nobody', async () => {
  const link = await fastify.portalSessionService.createPortalLink({ email: makeEmail() });

  expect(link.linkKey).toBeNull();
});

it('moves a session between the operators its user belongs to, and only those', async () => {
  const firstCustomer = await makeCustomer();
  const secondCustomer = await makeCustomer();
  const strangerCustomer = await makeCustomer();
  const email = makeEmail();

  for (const customer of [firstCustomer, secondCustomer]) {
    await fastify.portalUserService.createPortalMembership({
      customerId: customer.id,
      email,
      role: PortalRoleEnum.ACCOUNTANT,
    });
  }

  const portalAuth = await signIn(email);
  const switched = await fastify.portalSessionService.switchPortalSessionCustomer(
    portalAuth,
    secondCustomer.id,
  );

  expect(switched.customerId).toBe(secondCustomer.id);
  await expect(
    fastify.portalSessionService.switchPortalSessionCustomer(portalAuth, strangerCustomer.id),
  ).rejects.toThrow(UnauthorizedError);
});

it('ends a live session as soon as the membership behind it is removed', async () => {
  const customer = await makeCustomer();
  const email = makeEmail();
  const portalMembership = await fastify.portalUserService.createPortalMembership({
    customerId: customer.id,
    email,
    role: PortalRoleEnum.ACCOUNTANT,
  });
  const link = await fastify.portalSessionService.createPortalLink({ email });
  const portalSession = await fastify.portalSessionService.redeemPortalLink({
    linkKey: String(link.linkKey),
  });

  await fastify.portalUserService.deletePortalMembership(portalMembership.id);

  await expect(
    fastify.portalSessionService.authenticatePortalSession(String(portalSession.sessionKey)),
  ).rejects.toThrow(UnauthorizedError);
});

it('reads the role again on every request, so a role change applies at once', async () => {
  const customer = await makeCustomer();
  const email = makeEmail();
  const portalMembership = await fastify.portalUserService.createPortalMembership({
    customerId: customer.id,
    email,
    role: PortalRoleEnum.ACCOUNTANT,
  });
  const link = await fastify.portalSessionService.createPortalLink({ email });
  const portalSession = await fastify.portalSessionService.redeemPortalLink({
    linkKey: String(link.linkKey),
  });

  await fastify.portalUserService.updatePortalMembership(portalMembership.id, {
    role: PortalRoleEnum.OWNER,
  });

  const portalAuth = await fastify.portalSessionService.authenticatePortalSession(
    String(portalSession.sessionKey),
  );

  expect(portalAuth.role).toBe(PortalRoleEnum.OWNER);
});

it('refuses to remove the billing email of a customer from its portal', async () => {
  const customer = await makeCustomer();

  await signIn(customer.email);

  const memberships = await fastify.portalUserService.findPortalMemberships({
    customerId: customer.id,
  });
  const ownerMembershipId = String(_.get(memberships, 'data.0.id'));

  await expect(fastify.portalUserService.deletePortalMembership(ownerMembershipId)).rejects.toThrow(
    BadRequestError,
  );
});

it('refuses to give the same person access to the same operator twice', async () => {
  const customer = await makeCustomer();
  const email = makeEmail();
  const payload = { customerId: customer.id, email, role: PortalRoleEnum.ACCOUNTANT };

  await fastify.portalUserService.createPortalMembership(payload);

  await expect(fastify.portalUserService.createPortalMembership(payload)).rejects.toThrow(
    ConflictError,
  );
});

it('keeps a link opened by Vexere bound to its one operator, with no role', async () => {
  const customer = await makeCustomer();
  const customerLink = await fastify.portalSessionService.createCustomerPortalLink(customer.id);
  const linkKey = String(new URL(customerLink.url).searchParams.get('linkKey'));
  const portalSession = await fastify.portalSessionService.redeemPortalLink({ linkKey });

  const portalAuth = await fastify.portalSessionService.authenticatePortalSession(
    String(portalSession.sessionKey),
  );

  expect(portalAuth).toMatchObject({ portalUserId: null, role: null });
  await expect(
    fastify.portalSessionService.switchPortalSessionCustomer(portalAuth, customer.id),
  ).rejects.toThrow(ForbiddenError);
});
