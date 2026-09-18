import { PspTokenEnum } from '@clients/mock-psp.client';
import { PaymentMethodTypeEnum } from '@contracts/payment-methods.types';
import { PaymentCancellationReasonEnum } from '@contracts/payments.types';
import { SetupIntentStatusEnum, SetupIntentUsageEnum } from '@contracts/setup-intents.types';
import { BadRequestError, ConflictError, NotFoundError } from '@errors/app.error';
import { CurrencyEnum } from '@utils/currency';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestContext } from './context';
let fastify: FastifyInstance;

beforeAll(async () => {
  fastify = await buildTestContext();
});

afterAll(async () => {
  await fastify.close();
});

async function makeCustomer(): Promise<string> {
  const customer = await fastify.customerService.createCustomer({
    email: `${generateGid(ObjectPrefixEnum.CUSTOMER)}@example.test`,
    currency: CurrencyEnum.VND,
  });

  return customer.id;
}

async function makeUnattachedPaymentMethod(token: string = PspTokenEnum.VISA_OK) {
  return fastify.paymentMethodService.createPaymentMethod({
    type: PaymentMethodTypeEnum.CARD,
    token,
  });
}

describe('SetupIntentService.createSetupIntent', () => {
  it('waits for a payment method when the caller supplied none', async () => {
    const customerId = await makeCustomer();

    const setupIntent = await fastify.setupIntentService.createSetupIntent({ customerId });

    expect(setupIntent.status).toBe(SetupIntentStatusEnum.REQUIRES_PAYMENT_METHOD);
    expect(setupIntent.usage).toBe(SetupIntentUsageEnum.OFF_SESSION);
    expect(setupIntent.paymentMethodId).toBeNull();
  });

  it('is ready to confirm when the caller already picked a card', async () => {
    const customerId = await makeCustomer();
    const paymentMethod = await makeUnattachedPaymentMethod();

    const setupIntent = await fastify.setupIntentService.createSetupIntent({
      customerId,
      paymentMethodId: paymentMethod.id,
      usage: SetupIntentUsageEnum.ON_SESSION,
    });

    expect(setupIntent.status).toBe(SetupIntentStatusEnum.REQUIRES_CONFIRMATION);
    expect(setupIntent.usage).toBe(SetupIntentUsageEnum.ON_SESSION);
  });

  it('refuses a customer that does not exist', async () => {
    await expect(
      fastify.setupIntentService.createSetupIntent({ customerId: 'cus_missing' }),
    ).rejects.toThrow(NotFoundError);
  });
});

describe('SetupIntentService.confirmSetupIntent', () => {
  it('saves the card and makes it the default once the callback lands', async () => {
    const customerId = await makeCustomer();
    const paymentMethod = await makeUnattachedPaymentMethod();
    const setupIntent = await fastify.setupIntentService.createSetupIntent({
      customerId,
      paymentMethodId: paymentMethod.id,
    });

    const confirmed = await fastify.setupIntentService.confirmSetupIntent(setupIntent.id, {});

    await fastify.paymentService.drainProviderEvents();

    const saved = await fastify.setupIntentService.getSetupIntent(setupIntent.id);
    const customer = await fastify.customerRepository.findCustomer(customerId);
    const attached = await fastify.paymentMethodService.getPaymentMethod(paymentMethod.id);

    expect(confirmed.status).toBe(SetupIntentStatusEnum.PROCESSING);
    expect(saved.status).toBe(SetupIntentStatusEnum.SUCCEEDED);
    expect(customer?.defaultPaymentMethodId).toBe(paymentMethod.id);
    expect(attached.customerId).toBe(customerId);
  });

  it('takes no money while saving the card', async () => {
    const customerId = await makeCustomer();
    const paymentMethod = await makeUnattachedPaymentMethod();
    const setupIntent = await fastify.setupIntentService.createSetupIntent({
      customerId,
      paymentMethodId: paymentMethod.id,
    });

    await fastify.setupIntentService.confirmSetupIntent(setupIntent.id, {});
    await fastify.paymentService.drainProviderEvents();

    const { data } = await fastify.paymentService.findPaymentIntents({ customerId });

    expect(data).toHaveLength(0);
  });

  it('parks a card that needs 3DS and finishes it through the callback', async () => {
    const customerId = await makeCustomer();
    const paymentMethod = await makeUnattachedPaymentMethod(PspTokenEnum.VISA_3DS);
    const setupIntent = await fastify.setupIntentService.createSetupIntent({
      customerId,
      paymentMethodId: paymentMethod.id,
    });

    const confirmed = await fastify.setupIntentService.confirmSetupIntent(setupIntent.id, {});

    const { pspReference, nextAction } = confirmed;
    const authenticationReference = pspReference === null ? '' : pspReference;
    const expectedReference = pspReference === null ? 'no-reference' : pspReference;
    const redirectUrl = _.get(nextAction, 'redirectUrl');

    fastify.psp.completeAuthentication(authenticationReference);
    await fastify.paymentService.drainProviderEvents();

    const saved = await fastify.setupIntentService.getSetupIntent(setupIntent.id);

    expect(confirmed.status).toBe(SetupIntentStatusEnum.REQUIRES_ACTION);
    expect(redirectUrl).toContain(expectedReference);
    expect(saved.status).toBe(SetupIntentStatusEnum.SUCCEEDED);
  });

  it('sends the caller back for another card when the processor rejects this one', async () => {
    const customerId = await makeCustomer();
    const paymentMethod = await makeUnattachedPaymentMethod(PspTokenEnum.CARD_EXPIRED);
    const setupIntent = await fastify.setupIntentService.createSetupIntent({
      customerId,
      paymentMethodId: paymentMethod.id,
    });

    await fastify.setupIntentService.confirmSetupIntent(setupIntent.id, {});
    await fastify.paymentService.drainProviderEvents();

    const failed = await fastify.setupIntentService.getSetupIntent(setupIntent.id);
    const customer = await fastify.customerRepository.findCustomer(customerId);

    expect(failed.status).toBe(SetupIntentStatusEnum.REQUIRES_PAYMENT_METHOD);
    expect(failed.failureCode).toBe('expired_card');
    expect(customer?.defaultPaymentMethodId).toBeNull();
  });

  it('refuses to confirm without a payment method to save', async () => {
    const customerId = await makeCustomer();
    const setupIntent = await fastify.setupIntentService.createSetupIntent({ customerId });

    await expect(fastify.setupIntentService.confirmSetupIntent(setupIntent.id, {})).rejects.toThrow(
      BadRequestError,
    );
  });
});

describe('SetupIntentService.cancelSetupIntent', () => {
  it('keeps the reason the setup was abandoned', async () => {
    const customerId = await makeCustomer();
    const setupIntent = await fastify.setupIntentService.createSetupIntent({ customerId });

    const canceled = await fastify.setupIntentService.cancelSetupIntent(setupIntent.id, {
      cancellationReason: PaymentCancellationReasonEnum.ABANDONED,
    });

    expect(canceled.status).toBe(SetupIntentStatusEnum.CANCELED);
    expect(canceled.cancellationReason).toBe(PaymentCancellationReasonEnum.ABANDONED);
  });

  it('refuses to cancel a setup that already saved the card', async () => {
    const customerId = await makeCustomer();
    const paymentMethod = await makeUnattachedPaymentMethod();
    const setupIntent = await fastify.setupIntentService.createSetupIntent({
      customerId,
      paymentMethodId: paymentMethod.id,
    });

    await fastify.setupIntentService.confirmSetupIntent(setupIntent.id, {});
    await fastify.paymentService.drainProviderEvents();

    await expect(fastify.setupIntentService.cancelSetupIntent(setupIntent.id, {})).rejects.toThrow(
      ConflictError,
    );
  });
});
