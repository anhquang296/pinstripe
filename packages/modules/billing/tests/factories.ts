import { PspTokenEnum } from '@clients/mock-psp.client';
import type { PartnerPlatform } from '@contracts/customers.types';
import type { PaymentMethodResponse } from '@contracts/payment-methods.types';
import { PaymentMethodTypeEnum } from '@contracts/payment-methods.types';
import { RecurringIntervalEnum } from '@contracts/prices.types';
import type { BillingMode, CollectionMethod } from '@contracts/subscriptions.types';
import { BillingModeEnum, CollectionMethodEnum } from '@contracts/subscriptions.types';
import { CurrencyEnum } from '@utils/currency';
import { MILLISECONDS_PER_DAY } from '@vxrerp/platform/constants';
import { generateGid, ObjectPrefixEnum } from '@vxrerp/platform/utils';
import type { FastifyInstance } from 'fastify';

const DEFAULT_CLOCK_START = new Date(Date.now() - 2 * MILLISECONDS_PER_DAY).toISOString();
const DEFAULT_UNIT_AMOUNT = 500_000;
const DEFAULT_TOKEN = PspTokenEnum.VISA_OK;

export interface SubscriptionOverrides {
  unitAmount?: number;
  token?: string;
  frozenTime?: string;
  billingMode?: BillingMode;
  collectionMethod?: CollectionMethod;
  partnerPlatform?: PartnerPlatform;
  partnerAccountId?: string;
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
    collectionMethod = CollectionMethodEnum.CHARGE_AUTOMATICALLY,
    partnerPlatform,
    partnerAccountId,
  } = overrides;

  const clock = await fastify.testClockService.createTestClock({
    name: `clock ${generateGid(ObjectPrefixEnum.TEST_CLOCK)}`,
    frozenTime,
  });

  const customer = await fastify.customerService.createCustomer({
    email: `${generateGid(ObjectPrefixEnum.CUSTOMER)}@example.test`,
    currency: CurrencyEnum.VND,
    testClockId: clock.id,
    partnerPlatform,
    partnerAccountId,
  });

  const paymentMethod = await makePaymentMethod(fastify, customer.id, token);

  const product = await fastify.productService.createProduct({
    name: `Plan ${generateGid(ObjectPrefixEnum.PRODUCT)}`,
  });

  const price = await fastify.priceService.createPrice({
    productId: product.id,
    currency: CurrencyEnum.VND,
    unitAmount,
    recurring: { interval: RecurringIntervalEnum.MONTH },
  });

  const subscription = await fastify.subscriptionService.createSubscription({
    customerId: customer.id,
    items: [{ priceId: price.id }],
    billingMode,
    collectionMethod,
  });

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
  const paymentMethod = await fastify.paymentMethodService.createPaymentMethod({
    type: PaymentMethodTypeEnum.CARD,
    token,
    customerId,
  });

  return fastify.paymentMethodService.attachPaymentMethod(paymentMethod.id, {
    customerId,
    shouldBeDefault: true,
  });
}

export interface SettledChargeFixture {
  paymentIntentId: string;
  chargeId: string;
  chargeReference: string;
  amount: number;
}

export async function settleInvoice(
  fastify: FastifyInstance,
  invoiceId: string,
): Promise<SettledChargeFixture> {
  const paymentIntent = await fastify.paymentService.createPaymentIntent({ invoiceId });

  await fastify.paymentService.confirmPaymentIntent(paymentIntent.id, {});
  await fastify.paymentService.drainProviderEvents();

  const settled = await fastify.paymentService.getPaymentIntent(paymentIntent.id);

  const { latestChargeId, pspReference } = settled;

  if (latestChargeId && pspReference) {
    return {
      paymentIntentId: settled.id,
      chargeId: latestChargeId,
      chargeReference: pspReference,
      amount: settled.amount,
    };
  }

  throw new Error('settleInvoice() the payment intent settled without a charge');
}

export async function makeOpenInvoice(
  fastify: FastifyInstance,
  overrides: SubscriptionOverrides = {},
): Promise<OpenInvoiceFixture> {
  const fixture = await makeSubscription(fastify, overrides);

  const { data } = await fastify.invoiceService.findInvoices({
    subscriptionId: fixture.subscriptionId,
  });

  const [issuedInvoice] = data;

  if (issuedInvoice) {
    return { ...fixture, invoiceId: issuedInvoice.id };
  }

  const draft = await fastify.invoiceService.createInvoice({
    subscriptionId: fixture.subscriptionId,
  });

  const open = await fastify.invoiceService.finalizeInvoice(draft.id);

  return { ...fixture, invoiceId: open.id };
}
