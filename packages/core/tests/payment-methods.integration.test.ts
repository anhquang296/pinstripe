import { PspTokenEnum } from '@clients/mock-psp.client';
import { PaymentMethodTypeEnum } from '@contracts/payment-methods.types';
import { BadRequestError, ConflictError, NotFoundError } from '@errors/app.error';
import { CurrencyEnum } from '@utils/currency';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestContext } from './context';
import { makePaymentMethod, TEST_LIVEMODE } from './factories';

let fastify: FastifyInstance;

beforeAll(async () => {
  fastify = await buildTestContext();
});

afterAll(async () => {
  await fastify.close();
});

async function makeCustomer(): Promise<string> {
  const customer = await fastify.customerService.createCustomer(
    {
      email: `${generateGid(ObjectPrefixEnum.CUSTOMER)}@example.test`,
      currency: CurrencyEnum.VND,
    },
    TEST_LIVEMODE,
  );

  return customer.id;
}

describe('PaymentMethodService.createPaymentMethod', () => {
  it('keeps only the card metadata the processor hands back for a token', async () => {
    const paymentMethod = await fastify.paymentMethodService.createPaymentMethod(
      { type: PaymentMethodTypeEnum.CARD, token: PspTokenEnum.VISA_OK },
      TEST_LIVEMODE,
    );

    expect(paymentMethod.type).toBe(PaymentMethodTypeEnum.CARD);
    expect(paymentMethod.card).toMatchObject({ brand: 'visa', last4: '4242' });
    expect(paymentMethod.customerId).toBeNull();
  });

  it('carries no card details for a payment method that is not a card', async () => {
    const paymentMethod = await fastify.paymentMethodService.createPaymentMethod(
      { type: PaymentMethodTypeEnum.BANK_ACCOUNT, token: PspTokenEnum.BANK_OK },
      TEST_LIVEMODE,
    );

    expect(paymentMethod.card).toBeNull();
  });

  it('refuses a customer that does not exist', async () => {
    await expect(
      fastify.paymentMethodService.createPaymentMethod(
        {
          type: PaymentMethodTypeEnum.CARD,
          token: PspTokenEnum.VISA_OK,
          customerId: 'cus_missing',
        },
        TEST_LIVEMODE,
      ),
    ).rejects.toThrow(NotFoundError);
  });
});

describe('PaymentMethodService.attachPaymentMethod', () => {
  it('attaches the payment method and makes it the customer default when asked', async () => {
    const customerId = await makeCustomer();

    const attached = await makePaymentMethod(fastify, customerId);
    const customer = await fastify.customerRepository.findCustomer(customerId);

    expect(attached.customerId).toBe(customerId);
    expect(customer?.defaultPaymentMethodId).toBe(attached.id);
  });

  it('refuses to move a payment method to a second customer', async () => {
    const firstCustomerId = await makeCustomer();
    const secondCustomerId = await makeCustomer();
    const paymentMethod = await makePaymentMethod(fastify, firstCustomerId);

    await expect(
      fastify.paymentMethodService.attachPaymentMethod(
        paymentMethod.id,
        { customerId: secondCustomerId },
        TEST_LIVEMODE,
      ),
    ).rejects.toThrow(ConflictError);
  });

  it('refuses to reattach a payment method that was detached', async () => {
    const customerId = await makeCustomer();
    const paymentMethod = await makePaymentMethod(fastify, customerId);

    await fastify.paymentMethodService.detachPaymentMethod(paymentMethod.id, TEST_LIVEMODE);

    await expect(
      fastify.paymentMethodService.attachPaymentMethod(
        paymentMethod.id,
        { customerId },
        TEST_LIVEMODE,
      ),
    ).rejects.toThrow(ConflictError);
  });
});

describe('PaymentMethodService.detachPaymentMethod', () => {
  it('clears the customer default so nothing keeps charging a removed card', async () => {
    const customerId = await makeCustomer();
    const paymentMethod = await makePaymentMethod(fastify, customerId);

    const detached = await fastify.paymentMethodService.detachPaymentMethod(
      paymentMethod.id,
      TEST_LIVEMODE,
    );
    const customer = await fastify.customerRepository.findCustomer(customerId);

    expect(detached.detachedAt).not.toBeNull();
    expect(detached.customerId).toBeNull();
    expect(customer?.defaultPaymentMethodId).toBeNull();
  });

  it('refuses to charge a detached payment method', async () => {
    const customerId = await makeCustomer();
    const paymentMethod = await makePaymentMethod(fastify, customerId);

    await fastify.paymentMethodService.detachPaymentMethod(paymentMethod.id, TEST_LIVEMODE);

    await expect(
      fastify.paymentMethodService.getChargeablePaymentMethod(paymentMethod.id, TEST_LIVEMODE),
    ).rejects.toThrow(ConflictError);
  });

  it('refuses a second detach of the same payment method', async () => {
    const customerId = await makeCustomer();
    const paymentMethod = await makePaymentMethod(fastify, customerId);

    await fastify.paymentMethodService.detachPaymentMethod(paymentMethod.id, TEST_LIVEMODE);

    await expect(
      fastify.paymentMethodService.detachPaymentMethod(paymentMethod.id, TEST_LIVEMODE),
    ).rejects.toThrow(ConflictError);
  });
});

describe('PaymentMethodService.updatePaymentMethod', () => {
  it('moves the card expiry forward and merges the billing details', async () => {
    const customerId = await makeCustomer();
    const paymentMethod = await makePaymentMethod(fastify, customerId);

    const updated = await fastify.paymentMethodService.updatePaymentMethod(
      paymentMethod.id,
      { card: { expMonth: 3, expYear: 2035 }, billingDetails: { city: 'Da Nang' } },
      TEST_LIVEMODE,
    );

    expect(updated.card).toMatchObject({ expMonth: 3, expYear: 2035, last4: '4242' });
    expect(updated.billingDetails.city).toBe('Da Nang');
  });

  it('refuses a card update on a payment method that has no card', async () => {
    const paymentMethod = await fastify.paymentMethodService.createPaymentMethod(
      { type: PaymentMethodTypeEnum.WALLET, token: PspTokenEnum.WALLET_OK },
      TEST_LIVEMODE,
    );

    await expect(
      fastify.paymentMethodService.updatePaymentMethod(
        paymentMethod.id,
        { card: { expMonth: 1, expYear: 2035 } },
        TEST_LIVEMODE,
      ),
    ).rejects.toThrow(BadRequestError);
  });
});

describe('PaymentMethodService.findPaymentMethods', () => {
  it('lists only the payment methods of the customer it was asked about', async () => {
    const customerId = await makeCustomer();
    const otherCustomerId = await makeCustomer();

    await makePaymentMethod(fastify, customerId);
    await makePaymentMethod(fastify, otherCustomerId);

    const { data } = await fastify.paymentMethodService.findPaymentMethods(
      { customerId },
      TEST_LIVEMODE,
    );

    expect(data).toHaveLength(1);
    expect(data[0]?.customerId).toBe(customerId);
  });

  it('hides a test-mode payment method from a livemode read', async () => {
    const customerId = await makeCustomer();
    const paymentMethod = await makePaymentMethod(fastify, customerId);

    await expect(
      fastify.paymentMethodService.getPaymentMethod(paymentMethod.id, true),
    ).rejects.toThrow(NotFoundError);
  });
});
