import type { CheckoutSessionResponse } from '@vxrerp/core/contracts';
import {
  CheckoutSessionModeEnum,
  CurrencyEnum,
  RecurringIntervalEnum,
} from '@vxrerp/core/contracts';
import { HostedResourceEnum } from '@vxrerp/core/utils';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ALL_PERMISSIONS, buildAuthHeaders, buildTestApp, mintApiKey } from './context';

const SUCCESS_URL = 'https://merchant.test/thanks';
const UNIT_AMOUNT = 250_000;

let fastify: FastifyInstance;
let secretHeaders: Record<string, string>;

beforeAll(async () => {
  fastify = await buildTestApp();

  const secretKey = await mintApiKey(fastify, ALL_PERMISSIONS);

  secretHeaders = buildAuthHeaders(secretKey.token);
});

afterAll(async () => {
  await fastify.close();
});

async function makeCheckoutSession(): Promise<CheckoutSessionResponse> {
  const customer = await fastify.customerService.createCustomer({
    email: `hosted-${Date.now()}@vxrerp.test`,
    currency: CurrencyEnum.VND,
  });

  const product = await fastify.productService.createProduct({ name: 'Hosted plan' });

  const price = await fastify.priceService.createPrice({
    productId: product.id,
    currency: CurrencyEnum.VND,
    unitAmount: UNIT_AMOUNT,
    recurring: { interval: RecurringIntervalEnum.MONTH },
  });

  const response = await fastify.inject({
    method: 'POST',
    url: '/v1/checkout/sessions',
    headers: secretHeaders,
    payload: {
      mode: CheckoutSessionModeEnum.SUBSCRIPTION,
      customerId: customer.id,
      successUrl: SUCCESS_URL,
      lineItems: [{ priceId: price.id }],
    },
  });

  return response.json();
}

describe('hosted checkout page', () => {
  it('renders the session for a request carrying the signed token', async () => {
    const checkoutSession = await makeCheckoutSession();

    const token = fastify.hostedUrlFactory.buildToken(
      HostedResourceEnum.CHECKOUT_SESSION,
      checkoutSession.id,
    );

    const response = await fastify.inject({
      method: 'GET',
      url: `/v1/hosted/checkout/${checkoutSession.id}?token=${token}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.body).toContain('Hoàn tất thanh toán');
  });

  it('refuses a request with no token at all', async () => {
    const checkoutSession = await makeCheckoutSession();

    const response = await fastify.inject({
      method: 'GET',
      url: `/v1/hosted/checkout/${checkoutSession.id}`,
    });

    expect(response.statusCode).toBe(400);
  });

  it('refuses a token that signs a different session', async () => {
    const checkoutSession = await makeCheckoutSession();
    const other = await makeCheckoutSession();

    const token = fastify.hostedUrlFactory.buildToken(
      HostedResourceEnum.CHECKOUT_SESSION,
      other.id,
    );

    const response = await fastify.inject({
      method: 'GET',
      url: `/v1/hosted/checkout/${checkoutSession.id}?token=${token}`,
    });

    expect(response.statusCode).toBe(404);
  });

  it('completes the session from the posted form and redirects to the success url', async () => {
    const checkoutSession = await makeCheckoutSession();

    const token = fastify.hostedUrlFactory.buildToken(
      HostedResourceEnum.CHECKOUT_SESSION,
      checkoutSession.id,
    );

    const response = await fastify.inject({
      method: 'POST',
      url: `/v1/hosted/checkout/${checkoutSession.id}/complete?token=${token}`,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'token=tok_visa_ok',
    });

    const completed = await fastify.checkoutService.getCheckoutSession(checkoutSession.id);

    expect(response.statusCode).toBe(303);
    expect(response.headers.location).toBe(SUCCESS_URL);
    expect(completed.subscriptionId).toEqual(expect.any(String));
  });
});

describe('hosted invoice page', () => {
  it('renders the invoice and serves its pdf under the same token', async () => {
    const checkoutSession = await makeCheckoutSession();

    const checkoutToken = fastify.hostedUrlFactory.buildToken(
      HostedResourceEnum.CHECKOUT_SESSION,
      checkoutSession.id,
    );

    await fastify.inject({
      method: 'POST',
      url: `/v1/hosted/checkout/${checkoutSession.id}/complete?token=${checkoutToken}`,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'token=tok_visa_ok',
    });

    const completed = await fastify.checkoutService.getCheckoutSession(checkoutSession.id);
    const invoiceId = String(completed.invoiceId);
    const invoiceToken = fastify.hostedUrlFactory.buildToken(HostedResourceEnum.INVOICE, invoiceId);

    const page = await fastify.inject({
      method: 'GET',
      url: `/v1/hosted/invoice/${invoiceId}?token=${invoiceToken}`,
    });

    const pdf = await fastify.inject({
      method: 'GET',
      url: `/v1/hosted/invoice/${invoiceId}/pdf?token=${invoiceToken}`,
    });

    expect(page.statusCode).toBe(200);
    expect(page.body).toContain('Tải bản PDF');
    expect(pdf.statusCode).toBe(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect(pdf.rawPayload.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });
});
