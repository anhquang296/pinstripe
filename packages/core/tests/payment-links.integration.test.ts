import { CheckoutSessionModeEnum } from '@contracts/checkout.types';
import { DomainEventTypeEnum } from '@contracts/events.types';
import { ConflictError, NotFoundError } from '@errors/app.error';
import { HostedResourceEnum } from '@utils/hosted-url';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestContext } from './context';
import type { SubscriptionFixture } from './factories';
import { makeSubscription, TEST_LIVEMODE } from './factories';

const EVENT_SCAN_LIMIT = 200;
const SUCCESS_URL = 'https://merchant.test/thanks';

let fastify: FastifyInstance;

beforeAll(async () => {
  fastify = await buildTestContext();
});

afterAll(async () => {
  await fastify.close();
});

async function makeFixture(): Promise<SubscriptionFixture> {
  return makeSubscription(fastify);
}

describe('PaymentLinkService.createPaymentLink', () => {
  it('signs a hosted url and records the line items', async () => {
    const fixture = await makeFixture();

    const paymentLink = await fastify.paymentLinkService.createPaymentLink(
      { successUrl: SUCCESS_URL, lineItems: [{ priceId: fixture.priceId, quantity: 3 }] },
      TEST_LIVEMODE,
    );
    const token = fastify.hostedUrlFactory.buildToken(
      HostedResourceEnum.PAYMENT_LINK,
      paymentLink.id,
    );

    await fastify.outboxService.relayOutboxEvents(EVENT_SCAN_LIMIT);

    const published = await fastify.eventService.findEvents(
      { type: DomainEventTypeEnum.PAYMENT_LINK_CREATED, limit: 100 },
      TEST_LIVEMODE,
    );

    expect(paymentLink.isActive).toBe(true);
    expect(paymentLink.mode).toBe(CheckoutSessionModeEnum.PAYMENT);
    expect(paymentLink.lineItems[0]?.quantity).toBe(3);
    expect(paymentLink.url).toContain(token);
    expect(
      _.some(published.data, (event) => {
        return _.get(event.data.object, 'id') === paymentLink.id;
      }),
    ).toBe(true);
  });

  it('refuses a price that does not exist', async () => {
    await expect(
      fastify.paymentLinkService.createPaymentLink(
        { successUrl: SUCCESS_URL, lineItems: [{ priceId: 'price_nothing' }] },
        TEST_LIVEMODE,
      ),
    ).rejects.toThrow(NotFoundError);
  });
});

describe('PaymentLinkService.findPaymentLinks', () => {
  it('returns only switched-off links with their line items when asked for inactive ones', async () => {
    const fixture = await makeFixture();
    const activeLink = await fastify.paymentLinkService.createPaymentLink(
      { successUrl: SUCCESS_URL, lineItems: [{ priceId: fixture.priceId }] },
      TEST_LIVEMODE,
    );
    const inactiveLink = await fastify.paymentLinkService.createPaymentLink(
      { successUrl: SUCCESS_URL, lineItems: [{ priceId: fixture.priceId, quantity: 2 }] },
      TEST_LIVEMODE,
    );

    await fastify.paymentLinkService.updatePaymentLink(
      inactiveLink.id,
      { isActive: false },
      TEST_LIVEMODE,
    );

    const result = await fastify.paymentLinkService.findPaymentLinks(
      { isActive: false, limit: 100 },
      TEST_LIVEMODE,
    );
    const listedIds = _.map(result.data, 'id');
    const listedInactiveLink = _.find(result.data, { id: inactiveLink.id });

    expect(listedIds).toContain(inactiveLink.id);
    expect(listedIds).not.toContain(activeLink.id);
    expect(_.every(result.data, { isActive: false })).toBe(true);
    expect(_.get(listedInactiveLink, 'lineItems.0.quantity')).toBe(2);
  });
});

describe('CheckoutService.createPaymentLinkCheckoutSession', () => {
  it('opens a checkout session that carries the link line items', async () => {
    const fixture = await makeFixture();
    const paymentLink = await fastify.paymentLinkService.createPaymentLink(
      {
        mode: CheckoutSessionModeEnum.SUBSCRIPTION,
        successUrl: SUCCESS_URL,
        lineItems: [{ priceId: fixture.priceId }],
      },
      TEST_LIVEMODE,
    );

    const checkoutSession = await fastify.checkoutService.createPaymentLinkCheckoutSession(
      paymentLink.id,
      fixture.customerId,
      TEST_LIVEMODE,
    );

    expect(checkoutSession.paymentLinkId).toBe(paymentLink.id);
    expect(checkoutSession.mode).toBe(CheckoutSessionModeEnum.SUBSCRIPTION);
    expect(checkoutSession.lineItems[0]?.priceId).toBe(fixture.priceId);
  });

  it('refuses a link the merchant has switched off', async () => {
    const fixture = await makeFixture();
    const paymentLink = await fastify.paymentLinkService.createPaymentLink(
      { successUrl: SUCCESS_URL, lineItems: [{ priceId: fixture.priceId }] },
      TEST_LIVEMODE,
    );

    await fastify.paymentLinkService.updatePaymentLink(
      paymentLink.id,
      { isActive: false },
      TEST_LIVEMODE,
    );

    await expect(
      fastify.checkoutService.createPaymentLinkCheckoutSession(
        paymentLink.id,
        fixture.customerId,
        TEST_LIVEMODE,
      ),
    ).rejects.toThrow(ConflictError);
  });
});
