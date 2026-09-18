import {
  CheckoutPaymentStatusEnum,
  CheckoutSessionModeEnum,
  CheckoutSessionStatusEnum,
} from '@contracts/checkout.types';
import { DomainEventTypeEnum } from '@contracts/events.types';
import { BadRequestError, ConflictError, NotFoundError } from '@errors/app.error';
import { HostedResourceEnum } from '@utils/hosted-url';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestContext } from './context';
import type { SubscriptionFixture } from './factories';
import { makeSubscription } from './factories';

const EVENT_SCAN_LIMIT = 200;
const SUCCESS_URL = 'https://merchant.test/thanks';

let fastify: FastifyInstance;

beforeAll(async () => {
  fastify = await buildTestContext();
});

afterAll(async () => {
  await fastify.close();
});

function readToken(checkoutSessionId: string): string {
  return fastify.hostedUrlFactory.buildToken(
    HostedResourceEnum.CHECKOUT_SESSION,
    checkoutSessionId,
  );
}

async function makeFixture(): Promise<SubscriptionFixture> {
  return makeSubscription(fastify);
}

async function detectEvent(eventType: DomainEventTypeEnum, aggregateId: string): Promise<boolean> {
  await fastify.outboxService.relayOutboxEvents(EVENT_SCAN_LIMIT);

  const published = await fastify.eventService.findEvents({ type: eventType, limit: 100 });

  return _.some(published.data, (event) => {
    return _.get(event.data.object, 'id') === aggregateId;
  });
}

describe('CheckoutService.createCheckoutSession', () => {
  it('prices the line items and hands back a signed hosted url', async () => {
    const fixture = await makeFixture();

    const checkoutSession = await fastify.checkoutService.createCheckoutSession({
      mode: CheckoutSessionModeEnum.PAYMENT,
      customerId: fixture.customerId,
      successUrl: SUCCESS_URL,
      lineItems: [{ priceId: fixture.priceId, quantity: 2 }],
    });

    expect(checkoutSession.status).toBe(CheckoutSessionStatusEnum.OPEN);
    expect(checkoutSession.amountTotal).toBe(1_000_000);
    expect(checkoutSession.lineItems).toHaveLength(1);
    expect(checkoutSession.url).toContain(readToken(checkoutSession.id));
  });

  it('refuses a payment session with no line items', async () => {
    const fixture = await makeFixture();

    await expect(
      fastify.checkoutService.createCheckoutSession({
        mode: CheckoutSessionModeEnum.PAYMENT,
        customerId: fixture.customerId,
        successUrl: SUCCESS_URL,
      }),
    ).rejects.toThrow(BadRequestError);
  });

  it('refuses a setup session that carries line items', async () => {
    const fixture = await makeFixture();

    await expect(
      fastify.checkoutService.createCheckoutSession({
        mode: CheckoutSessionModeEnum.SETUP,
        customerId: fixture.customerId,
        successUrl: SUCCESS_URL,
        lineItems: [{ priceId: fixture.priceId }],
      }),
    ).rejects.toThrow(BadRequestError);
  });
});

describe('CheckoutService.completeCheckoutSession', () => {
  it('holds nothing until it completes, then issues the subscription', async () => {
    const fixture = await makeFixture();
    const checkoutSession = await fastify.checkoutService.createCheckoutSession({
      mode: CheckoutSessionModeEnum.SUBSCRIPTION,
      customerId: fixture.customerId,
      successUrl: SUCCESS_URL,
      lineItems: [{ priceId: fixture.priceId }],
    });
    const before = await fastify.subscriptionService.findSubscriptions({
      customerId: fixture.customerId,
      limit: 100,
    });

    const completed = await fastify.checkoutService.completeCheckoutSession(
      checkoutSession.id,
      { paymentMethodId: fixture.paymentMethodId },
      readToken(checkoutSession.id),
    );
    const after = await fastify.subscriptionService.findSubscriptions({
      customerId: fixture.customerId,
      limit: 100,
    });

    expect(completed.status).toBe(CheckoutSessionStatusEnum.COMPLETE);
    expect(completed.subscriptionId).toEqual(expect.any(String));
    expect(after.data.length).toBe(before.data.length + 1);
    expect(await detectEvent(DomainEventTypeEnum.CHECKOUT_SESSION_COMPLETED, completed.id)).toBe(
      true,
    );
  });

  it('saves a card and nothing else in setup mode', async () => {
    const fixture = await makeFixture();
    const checkoutSession = await fastify.checkoutService.createCheckoutSession({
      mode: CheckoutSessionModeEnum.SETUP,
      customerId: fixture.customerId,
      successUrl: SUCCESS_URL,
    });

    const completed = await fastify.checkoutService.completeCheckoutSession(
      checkoutSession.id,
      { paymentMethodId: fixture.paymentMethodId },
      readToken(checkoutSession.id),
    );

    expect(completed.setupIntentId).toEqual(expect.any(String));
    expect(completed.subscriptionId).toBeNull();
    expect(completed.paymentStatus).toBe(CheckoutPaymentStatusEnum.NO_PAYMENT_REQUIRED);
  });

  it('bills an invoice and confirms a payment intent in payment mode', async () => {
    const fixture = await makeFixture();
    const checkoutSession = await fastify.checkoutService.createCheckoutSession({
      mode: CheckoutSessionModeEnum.PAYMENT,
      customerId: fixture.customerId,
      successUrl: SUCCESS_URL,
      lineItems: [{ priceId: fixture.priceId }],
    });

    const completed = await fastify.checkoutService.completeCheckoutSession(
      checkoutSession.id,
      { paymentMethodId: fixture.paymentMethodId },
      readToken(checkoutSession.id),
    );

    expect(completed.invoiceId).toEqual(expect.any(String));
    expect(completed.paymentIntentId).toEqual(expect.any(String));
  });

  it('refuses a token that does not sign this session', async () => {
    const fixture = await makeFixture();
    const checkoutSession = await fastify.checkoutService.createCheckoutSession({
      mode: CheckoutSessionModeEnum.SETUP,
      customerId: fixture.customerId,
      successUrl: SUCCESS_URL,
    });

    await expect(
      fastify.checkoutService.completeCheckoutSession(
        checkoutSession.id,
        { paymentMethodId: fixture.paymentMethodId },
        'deadbeefdeadbeefdeadbeefdeadbeef',
      ),
    ).rejects.toThrow(NotFoundError);
  });

  it('refuses a session that has already completed', async () => {
    const fixture = await makeFixture();
    const checkoutSession = await fastify.checkoutService.createCheckoutSession({
      mode: CheckoutSessionModeEnum.SETUP,
      customerId: fixture.customerId,
      successUrl: SUCCESS_URL,
    });
    const token = readToken(checkoutSession.id);

    await fastify.checkoutService.completeCheckoutSession(
      checkoutSession.id,
      { paymentMethodId: fixture.paymentMethodId },
      token,
    );

    await expect(
      fastify.checkoutService.completeCheckoutSession(
        checkoutSession.id,
        { paymentMethodId: fixture.paymentMethodId },
        token,
      ),
    ).rejects.toThrow(ConflictError);
  });
});

describe('CheckoutService.expireCheckoutSessions', () => {
  it('closes a session past its deadline and publishes the expiry', async () => {
    const fixture = await makeFixture();
    const checkoutSession = await fastify.checkoutService.createCheckoutSession({
      mode: CheckoutSessionModeEnum.SETUP,
      customerId: fixture.customerId,
      successUrl: SUCCESS_URL,
    });

    await fastify.database.master.execute(
      `update checkout_sessions set expires_at = now() - interval '1 minute' where id = '${checkoutSession.id}'`,
    );

    const expired = await fastify.checkoutService.expireCheckoutSessions();
    const closed = await fastify.checkoutService.getCheckoutSession(checkoutSession.id);

    expect(expired).toBeGreaterThan(0);
    expect(closed.status).toBe(CheckoutSessionStatusEnum.EXPIRED);
    expect(await detectEvent(DomainEventTypeEnum.CHECKOUT_SESSION_EXPIRED, closed.id)).toBe(true);
  });

  it('refuses to complete a session whose deadline has passed', async () => {
    const fixture = await makeFixture();
    const checkoutSession = await fastify.checkoutService.createCheckoutSession({
      mode: CheckoutSessionModeEnum.SETUP,
      customerId: fixture.customerId,
      successUrl: SUCCESS_URL,
    });

    await fastify.database.master.execute(
      `update checkout_sessions set expires_at = now() - interval '1 minute' where id = '${checkoutSession.id}'`,
    );

    await expect(
      fastify.checkoutService.completeCheckoutSession(
        checkoutSession.id,
        { paymentMethodId: fixture.paymentMethodId },
        readToken(checkoutSession.id),
      ),
    ).rejects.toThrow(ConflictError);
  });
});
