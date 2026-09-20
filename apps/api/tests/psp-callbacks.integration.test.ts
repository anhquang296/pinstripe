import {
  ApiKeyScopeEnum,
  PaymentIntentStatusEnum,
  PaymentMethodTypeEnum,
  PspEventTypeEnum,
} from '@pinstripe/core/contracts';
import { buildWebhookSignature, WEBHOOK_SIGNATURE_HEADER } from '@pinstripe/core/utils';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildAuthHeaders, buildTestApp, mintApiKey } from './context';

const CALLBACKS_URL = '/api/v1/system/psp/mock/callbacks';
const APPROVED_TOKEN = 'tok_visa_ok';
const STANDALONE_AMOUNT = 250_000;

let fastify: FastifyInstance;
let secretToken: string;

beforeAll(async () => {
  fastify = await buildTestApp();

  const apiKey = await mintApiKey(fastify, [ApiKeyScopeEnum.V1]);

  secretToken = apiKey.token;
});

afterAll(async () => {
  await fastify.close();
});

function readCallbackSecret(): string {
  const { PSP_WEBHOOK_SECRET } = fastify.config;

  if (PSP_WEBHOOK_SECRET) {
    return PSP_WEBHOOK_SECRET;
  }

  throw new Error('test fixture ran without PSP_WEBHOOK_SECRET configured');
}

async function postCallback(
  body: Record<string, unknown>,
  options: { signedAt?: Date; secret?: string } = {},
) {
  const { signedAt = new Date(), secret = readCallbackSecret() } = options;

  const payload = JSON.stringify(body);

  return fastify.inject({
    method: 'POST',
    url: CALLBACKS_URL,
    payload,
    headers: {
      'content-type': 'application/json',
      [WEBHOOK_SIGNATURE_HEADER]: buildWebhookSignature(payload, secret, signedAt),
    },
  });
}

async function makeProcessingPaymentIntent() {
  const headers = { ...buildAuthHeaders(secretToken), 'content-type': 'application/json' };

  const customerResponse = await fastify.inject({
    method: 'POST',
    url: '/v1/customers',
    headers,
    payload: { email: `psp-${Date.now()}-${Math.random()}@example.test`, currency: 'vnd' },
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
    payload: { customerId, amount: STANDALONE_AMOUNT },
  });

  const paymentIntentId = paymentIntentResponse.json().id;

  const confirmed = await fastify.inject({
    method: 'POST',
    url: `/v1/payment_intents/${paymentIntentId}/confirm`,
    headers,
    payload: {},
  });

  fastify.psp.takePendingEvents();

  return { paymentIntentId, pspReference: confirmed.json().pspReference as string };
}

async function readPaymentIntent(paymentIntentId: string) {
  const response = await fastify.inject({
    method: 'GET',
    url: `/v1/payment_intents/${paymentIntentId}`,
    headers: buildAuthHeaders(secretToken),
  });

  return response.json();
}

describe('POST /api/v1/system/psp/:provider/callbacks signature', () => {
  it('rejects a callback that carries no signature header', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: CALLBACKS_URL,
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({
        id: 'evt_1',
        type: PspEventTypeEnum.PAYMENT_SUCCEEDED,
        reference: 'ref',
      }),
    });

    expect(response.statusCode).toBe(401);
  });

  it('rejects a callback signed with the wrong secret', async () => {
    const response = await postCallback(
      { id: 'evt_wrong_secret', type: PspEventTypeEnum.PAYMENT_SUCCEEDED, reference: 'ref' },
      { secret: 'whsec_not_the_configured_secret' },
    );

    expect(response.statusCode).toBe(401);
  });

  it('rejects a callback signed outside the tolerance window', async () => {
    const staleAt = new Date(
      Date.now() - (fastify.config.PSP_CALLBACK_TOLERANCE_SECONDS + 60) * 1000,
    );

    const response = await postCallback(
      { id: 'evt_stale', type: PspEventTypeEnum.PAYMENT_SUCCEEDED, reference: 'ref' },
      { signedAt: staleAt },
    );

    expect(response.statusCode).toBe(401);
  });

  it('needs no API key because the signature is the credential', async () => {
    const { pspReference } = await makeProcessingPaymentIntent();

    const response = await postCallback({
      id: `evt_no_api_key_${pspReference}`,
      type: PspEventTypeEnum.PAYMENT_SUCCEEDED,
      reference: pspReference,
      amount: STANDALONE_AMOUNT,
    });

    expect(response.statusCode).toBe(200);
  });
});

describe('POST /api/v1/system/psp/:provider/callbacks state machine', () => {
  it('drives a processing intent to succeeded', async () => {
    const { paymentIntentId, pspReference } = await makeProcessingPaymentIntent();

    await postCallback({
      id: `evt_success_${pspReference}`,
      type: PspEventTypeEnum.PAYMENT_SUCCEEDED,
      reference: pspReference,
      amount: STANDALONE_AMOUNT,
    });

    const settled = await readPaymentIntent(paymentIntentId);

    expect(settled.status).toBe(PaymentIntentStatusEnum.SUCCEEDED);
    expect(settled.amountReceived).toBe(STANDALONE_AMOUNT);
    expect(settled.charges).toHaveLength(1);
  });

  it('reports a redelivered callback as a duplicate and charges only once', async () => {
    const { paymentIntentId, pspReference } = await makeProcessingPaymentIntent();

    const body = {
      id: `evt_replay_${pspReference}`,
      type: PspEventTypeEnum.PAYMENT_SUCCEEDED,
      reference: pspReference,
      amount: STANDALONE_AMOUNT,
    };

    const first = await postCallback(body);
    const second = await postCallback(body);
    const settled = await readPaymentIntent(paymentIntentId);

    expect(first.json().isDuplicate).toBe(false);
    expect(second.json().isDuplicate).toBe(true);
    expect(settled.charges).toHaveLength(1);
  });

  it('sends a declined intent back for another payment method', async () => {
    const { paymentIntentId, pspReference } = await makeProcessingPaymentIntent();

    await postCallback({
      id: `evt_declined_${pspReference}`,
      type: PspEventTypeEnum.PAYMENT_FAILED,
      reference: pspReference,
      failureCode: 'card_declined',
      declineCode: 'stolen_card',
      failureMessage: 'The card has been reported stolen',
    });

    const declined = await readPaymentIntent(paymentIntentId);

    expect(declined.status).toBe(PaymentIntentStatusEnum.REQUIRES_PAYMENT_METHOD);
    expect(declined.declineCode).toBe('stolen_card');
  });

  it('rejects a callback for a reference no intent was ever given', async () => {
    const response = await postCallback({
      id: 'evt_unknown_reference',
      type: PspEventTypeEnum.PAYMENT_SUCCEEDED,
      reference: 'mockpsp_nothing_here',
      amount: 1_000,
    });

    expect(response.statusCode).toBe(404);
  });
});
