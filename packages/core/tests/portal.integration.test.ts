import { PortalSessionStatusEnum } from '@contracts/portal.types';
import { UnauthorizedError } from '@errors/app.error';
import { CurrencyEnum } from '@utils/currency';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestContext } from './context';
import { TEST_LIVEMODE } from './factories';

let fastify: FastifyInstance;

beforeAll(async () => {
  fastify = await buildTestContext();
});

afterAll(async () => {
  await fastify.close();
});

async function makeCustomer(): Promise<{ id: string; email: string }> {
  const email = `${generateGid(ObjectPrefixEnum.CUSTOMER)}@portal.test`;
  const customer = await fastify.customerService.createCustomer(
    { email, currency: CurrencyEnum.VND, name: 'Portal Tester' },
    TEST_LIVEMODE,
  );

  return { id: customer.id, email };
}

async function makeActiveSession(): Promise<{ customerId: string; sessionKey: string }> {
  const customer = await makeCustomer();
  const link = await fastify.portalSessionService.createPortalLink(
    { email: customer.email },
    TEST_LIVEMODE,
  );
  const { linkKey } = link;

  if (!linkKey) {
    throw new Error('test fixture did not mint a portal link');
  }

  const portalSession = await fastify.portalSessionService.redeemPortalLink(
    { linkKey },
    TEST_LIVEMODE,
  );
  const { sessionKey } = portalSession;

  if (!sessionKey) {
    throw new Error('test fixture redeemed a portal link without a session key');
  }

  return { customerId: customer.id, sessionKey };
}

describe('PortalSessionService.createPortalLink', () => {
  it('mints a pending session for a customer that exists', async () => {
    const customer = await makeCustomer();

    const link = await fastify.portalSessionService.createPortalLink(
      { email: customer.email },
      TEST_LIVEMODE,
    );

    const [portalSession] = await fastify.portalSessionRepository.findPortalSessions(
      { customerId: customer.id },
      1,
    );

    expect(link.linkKey).toEqual(expect.any(String));
    expect(portalSession?.status).toBe(PortalSessionStatusEnum.PENDING);
    expect(portalSession?.sessionTokenHash).toBeNull();
  });

  it('mints nothing and says nothing when no customer owns the address', async () => {
    const link = await fastify.portalSessionService.createPortalLink(
      { email: 'nobody@portal.test' },
      TEST_LIVEMODE,
    );

    expect(link.linkKey).toBeNull();
    expect(link.linkExpiresAt).toBeInstanceOf(Date);
  });
});

describe('PortalSessionService.redeemPortalLink', () => {
  it('exchanges a link for a session key exactly once', async () => {
    const customer = await makeCustomer();
    const link = await fastify.portalSessionService.createPortalLink(
      { email: customer.email },
      TEST_LIVEMODE,
    );
    const linkKey = String(link.linkKey);

    const portalSession = await fastify.portalSessionService.redeemPortalLink(
      { linkKey },
      TEST_LIVEMODE,
    );

    expect(portalSession.status).toBe(PortalSessionStatusEnum.ACTIVE);
    expect(portalSession.sessionKey).toEqual(expect.any(String));

    await expect(
      fastify.portalSessionService.redeemPortalLink({ linkKey }, TEST_LIVEMODE),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('refuses a link key that matches nothing', async () => {
    await expect(
      fastify.portalSessionService.redeemPortalLink(
        { linkKey: 'not-a-real-link-key-at-all' },
        TEST_LIVEMODE,
      ),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('refuses a link whose deadline has passed', async () => {
    const customer = await makeCustomer();
    const link = await fastify.portalSessionService.createPortalLink(
      { email: customer.email },
      TEST_LIVEMODE,
    );

    await fastify.database.master.execute(
      `update portal_sessions set link_expires_at = now() - interval '1 minute' where customer_id = '${customer.id}'`,
    );

    await expect(
      fastify.portalSessionService.redeemPortalLink(
        { linkKey: String(link.linkKey) },
        TEST_LIVEMODE,
      ),
    ).rejects.toThrow(UnauthorizedError);
  });
});

describe('PortalSessionService.authenticatePortalSession', () => {
  it('resolves the customer behind an active session key', async () => {
    const { customerId, sessionKey } = await makeActiveSession();

    const auth = await fastify.portalSessionService.authenticatePortalSession(sessionKey);

    expect(auth.customerId).toBe(customerId);
    expect(auth.livemode).toBe(TEST_LIVEMODE);
  });

  it('refuses a session key that was revoked', async () => {
    const { sessionKey } = await makeActiveSession();
    const auth = await fastify.portalSessionService.authenticatePortalSession(sessionKey);

    await fastify.portalSessionService.revokePortalSession(auth.portalSessionId);

    await expect(
      fastify.portalSessionService.authenticatePortalSession(sessionKey),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('refuses a session key whose window has closed', async () => {
    const { customerId, sessionKey } = await makeActiveSession();

    await fastify.database.master.execute(
      `update portal_sessions set session_expires_at = now() - interval '1 minute' where customer_id = '${customerId}'`,
    );

    await expect(
      fastify.portalSessionService.authenticatePortalSession(sessionKey),
    ).rejects.toThrow(UnauthorizedError);
  });
});

describe('BillingPortalService', () => {
  it('creates a default configuration on demand and keeps exactly one default', async () => {
    const first = await fastify.billingPortalService.getActiveConfiguration(TEST_LIVEMODE);
    const second = await fastify.billingPortalService.createConfiguration(
      { businessName: 'Cửa hàng mới', isDefault: true },
      TEST_LIVEMODE,
    );
    const defaults =
      await fastify.billingPortalConfigurationRepository.findBillingPortalConfigurations({
        livemode: TEST_LIVEMODE,
        isDefault: true,
      });

    expect(first.isDefault).toBe(true);
    expect(second.features.canViewInvoiceHistory).toBe(true);
    expect(defaults).toHaveLength(1);
    expect(defaults[0]?.id).toBe(second.id);
  });

  it('hands a merchant-created session a portal session key the customer can use', async () => {
    const customer = await makeCustomer();

    const session = await fastify.billingPortalService.createSession(
      { customerId: customer.id },
      TEST_LIVEMODE,
    );
    const portalSession = await fastify.portalSessionService.getPortalSession(
      session.portalSessionId,
    );

    expect(session.url).toContain('sessionKey=');
    expect(portalSession.status).toBe(PortalSessionStatusEnum.ACTIVE);
    expect(portalSession.customerId).toBe(customer.id);
  });
});
