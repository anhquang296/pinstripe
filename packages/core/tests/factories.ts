import { PspTokenEnum } from '@clients/mock-psp.client';
import { MILLISECONDS_PER_DAY } from '@constants/time';
import type { PaymentMethodResponse } from '@contracts/payment-methods.types';
import { PaymentMethodTypeEnum } from '@contracts/payment-methods.types';
import { RecurringIntervalEnum } from '@contracts/prices.types';
import type { BillingMode } from '@contracts/subscriptions.types';
import { BillingModeEnum } from '@contracts/subscriptions.types';
import { CurrencyEnum } from '@utils/currency';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';

const DEFAULT_CLOCK_START = new Date(Date.now() - 2 * MILLISECONDS_PER_DAY).toISOString();
const DEFAULT_UNIT_AMOUNT = 500_000;
const DEFAULT_TOKEN = PspTokenEnum.VISA_OK;

export const TEST_LIVEMODE = false;

export interface SubscriptionOverrides {
  unitAmount?: number;
  token?: string;
  frozenTime?: string;
  billingMode?: BillingMode;
}

export interface SubscriptionFixture {
  subscriptionId: string;
  customerId: string;
  productId: string;
  priceId: string;
  testClockId: string;
  paymentMethodId: string;
}

export interface OpenInvoiceFixture extends SubscriptionFixture {
  invoiceId: string;
}

export async function makeSubscription(
  fastify: FastifyInstance,
  overrides: SubscriptionOverrides = {},
): Promise<SubscriptionFixture> {
  const {
    unitAmount = DEFAULT_UNIT_AMOUNT,
    token = DEFAULT_TOKEN,
    frozenTime = DEFAULT_CLOCK_START,
    billingMode = BillingModeEnum.ADVANCE,
  } = overrides;

  const clock = await fastify.testClockService.createTestClock({
    name: `clock ${generateGid(ObjectPrefixEnum.TEST_CLOCK)}`,
    frozenTime,
  });
  const customer = await fastify.customerService.createCustomer(
    {
      email: `${generateGid(ObjectPrefixEnum.CUSTOMER)}@example.test`,
      currency: CurrencyEnum.VND,
      testClockId: clock.id,
    },
    TEST_LIVEMODE,
  );
  const paymentMethod = await makePaymentMethod(fastify, customer.id, token);
  const product = await fastify.productService.createProduct(
    { name: `Plan ${generateGid(ObjectPrefixEnum.PRODUCT)}` },
    TEST_LIVEMODE,
  );
  const price = await fastify.priceService.createPrice(
    {
      productId: product.id,
      currency: CurrencyEnum.VND,
      unitAmount,
      recurring: { interval: RecurringIntervalEnum.MONTH },
    },
    false,
  );
  const subscription = await fastify.subscriptionService.createSubscription(
    {
      customerId: customer.id,
      items: [{ priceId: price.id }],
      billingMode,
    },
    false,
  );

  return {
    subscriptionId: subscription.id,
    customerId: customer.id,
    productId: product.id,
    priceId: price.id,
    testClockId: clock.id,
    paymentMethodId: paymentMethod.id,
  };
}

export async function makePaymentMethod(
  fastify: FastifyInstance,
  customerId: string,
  token: string = DEFAULT_TOKEN,
): Promise<PaymentMethodResponse> {
  const paymentMethod = await fastify.paymentMethodService.createPaymentMethod(
    { type: PaymentMethodTypeEnum.CARD, token, customerId },
    TEST_LIVEMODE,
  );

  return fastify.paymentMethodService.attachPaymentMethod(
    paymentMethod.id,
    { customerId, shouldBeDefault: true },
    TEST_LIVEMODE,
  );
}

export async function makeOpenInvoice(
  fastify: FastifyInstance,
  overrides: SubscriptionOverrides = {},
): Promise<OpenInvoiceFixture> {
  const fixture = await makeSubscription(fastify, overrides);
  const { data } = await fastify.invoiceService.findInvoices(
    { subscriptionId: fixture.subscriptionId },
    TEST_LIVEMODE,
  );
  const [issuedInvoice] = data;

  if (issuedInvoice) {
    return { ...fixture, invoiceId: issuedInvoice.id };
  }

  const draft = await fastify.invoiceService.createInvoice(
    { subscriptionId: fixture.subscriptionId },
    TEST_LIVEMODE,
  );
  const open = await fastify.invoiceService.finalizeInvoice(draft.id);

  return { ...fixture, invoiceId: open.id };
}
