import { DisputeReasonEnum, PaymentMethodTypeEnum } from '@pinstripe/core/contracts';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ALL_PERMISSIONS, buildAuthHeaders, buildTestApp, mintApiKey } from './context';

const APPROVED_TOKEN = 'tok_visa_ok';
const CHARGE_AMOUNT = 250_000;

let fastify: FastifyInstance;
let secretToken: string;

beforeAll(async () => {
  fastify = await buildTestApp();

  const apiKey = await mintApiKey(fastify, ALL_PERMISSIONS);

  secretToken = apiKey.token;
});

afterAll(async () => {
  await fastify.close();
});

function buildHeaders(): Record<string, string> {
  return { ...buildAuthHeaders(secretToken), 'content-type': 'application/json' };
}

async function settleStandaloneCharge(): Promise<{ chargeId: string; chargeReference: string }> {
  const headers = buildHeaders();

  const customerResponse = await fastify.inject({
    method: 'POST',
    url: '/v1/customers',
    headers,
    payload: { email: `cash-${Date.now()}-${Math.random()}@example.test`, currency: 'vnd' },
  });

  const customerId = customerResponse.json().id;

  const paymentMethodResponse = await fastify.inject({
    method: 'POST',
    url: '/v1/payment_methods',
    headers,
    payload: { type: PaymentMethodTypeEnum.CARD, token: APPROVED_TOKEN, customerId },
  });

  const paymentMethodId = paymentMethodResponse.json().id;

  await fastify.inject({
    method: 'POST',
    url: `/v1/payment_methods/${paymentMethodId}/attach`,
    headers,
    payload: { customerId, shouldBeDefault: true },
  });

  const paymentIntentResponse = await fastify.inject({
    method: 'POST',
    url: '/v1/payment_intents',
    headers,
    payload: { customerId, amount: CHARGE_AMOUNT },
  });

  const paymentIntentId = paymentIntentResponse.json().id;

  await fastify.inject({
    method: 'POST',
    url: `/v1/payment_intents/${paymentIntentId}/confirm`,
    headers,
    payload: {},
  });
  await fastify.paymentService.drainProviderEvents();

  const settled = await fastify.paymentService.getPaymentIntent(paymentIntentId);

  const { latestChargeId, pspReference } = settled;

  if (latestChargeId && pspReference) {
    return { chargeId: latestChargeId, chargeReference: pspReference };
  }

  throw new Error('settleStandaloneCharge() the payment intent settled without a charge');
}

describe('GET /v1/balance', () => {
  it('answers with the three pots a merchant can be in', async () => {
    await settleStandaloneCharge();

    const response = await fastify.inject({
      method: 'GET',
      url: '/v1/balance',
      headers: buildAuthHeaders(secretToken),
    });

    const balance = response.json();

    expect(response.statusCode).toBe(200);
    expect(balance).not.toHaveProperty('object');
    expect(balance.pending.length).toBeGreaterThan(0);
    expect(balance.available).toBeDefined();
    expect(balance.reserved).toBeDefined();
  });

  it('refuses a caller without a key', async () => {
    const response = await fastify.inject({ method: 'GET', url: '/v1/balance' });

    expect(response.statusCode).toBe(401);
  });
});

describe('GET /v1/balance_transactions', () => {
  it('lists the balance transaction a settled charge produced', async () => {
    const { chargeId } = await settleStandaloneCharge();

    const response = await fastify.inject({
      method: 'GET',
      url: '/v1/balance_transactions?limit=100',
      headers: buildAuthHeaders(secretToken),
    });

    const listed = response.json();

    const sourceIds = listed.data.map((balanceTransaction: { sourceId: string }) => {
      return balanceTransaction.sourceId;
    });

    expect(response.statusCode).toBe(200);
    expect(sourceIds).toContain(chargeId);
  });
});

describe('POST /v1/payouts', () => {
  it('refuses to pay out a balance that is still pending', async () => {
    await settleStandaloneCharge();

    const response = await fastify.inject({
      method: 'POST',
      url: '/v1/payouts',
      headers: buildHeaders(),
      payload: { currency: 'vnd' },
    });

    expect(response.statusCode).toBe(409);
  });

  it('creates a payout once the balance is available and lists it back', async () => {
    await settleStandaloneCharge();
    await fastify.database.master.execute(
      `update balance_transactions set available_on = now() - interval '1 day' where payout_id is null`,
    );

    const created = await fastify.inject({
      method: 'POST',
      url: '/v1/payouts',
      headers: buildHeaders(),
      payload: { currency: 'vnd', statementDescriptor: 'PINSTRIPE' },
    });

    const payout = created.json();

    const listed = await fastify.inject({
      method: 'GET',
      url: '/v1/payouts',
      headers: buildAuthHeaders(secretToken),
    });

    const ids = listed.json().data.map((row: { id: string }) => {
      return row.id;
    });

    expect(created.statusCode).toBe(201);
    expect(payout.status).toBe('in_transit');
    expect(payout.amount).toBeGreaterThan(0);
    expect(ids).toContain(payout.id);
  });
});

describe('POST /v1/disputes/:disputeId/evidence', () => {
  it('files evidence against a dispute the processor opened', async () => {
    const { chargeId, chargeReference } = await settleStandaloneCharge();

    fastify.psp.openDispute({
      reference: chargeReference,
      amount: 50_000,
      reason: DisputeReasonEnum.FRAUDULENT,
    });

    await fastify.paymentService.drainProviderEvents();

    const listed = await fastify.inject({
      method: 'GET',
      url: `/v1/disputes?chargeId=${chargeId}`,
      headers: buildAuthHeaders(secretToken),
    });

    const [dispute] = listed.json().data;

    const response = await fastify.inject({
      method: 'POST',
      url: `/v1/disputes/${dispute.id}/evidence`,
      headers: buildHeaders(),
      payload: { evidence: { uncategorizedText: 'Đơn hàng đã giao' } },
    });

    expect(listed.statusCode).toBe(200);
    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('under_review');
  });
});
