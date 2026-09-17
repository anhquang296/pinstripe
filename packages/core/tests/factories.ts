import { MILLISECONDS_PER_DAY } from '@constants/time';
import { RecurringIntervalEnum } from '@contracts/prices.types';
import { CurrencyEnum } from '@utils/currency';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';

const DEFAULT_CLOCK_START = new Date(Date.now() - 2 * MILLISECONDS_PER_DAY).toISOString();
const DEFAULT_UNIT_AMOUNT = 500_000;
const DEFAULT_PAYMENT_METHOD = 'pm_card_ok';

export const TEST_LIVEMODE = false;

export interface SubscriptionOverrides {
  unitAmount?: number;
  paymentMethod?: string;
  frozenTime?: string;
}

export interface SubscriptionFixture {
  subscriptionId: string;
  customerId: string;
  productId: string;
  priceId: string;
  testClockId: string;
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
    paymentMethod = DEFAULT_PAYMENT_METHOD,
    frozenTime = DEFAULT_CLOCK_START,
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
      defaultPaymentMethod: paymentMethod,
    },
    TEST_LIVEMODE,
  );
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
    },
    false,
  );

  return {
    subscriptionId: subscription.id,
    customerId: customer.id,
    productId: product.id,
    priceId: price.id,
    testClockId: clock.id,
  };
}

export async function makeOpenInvoice(
  fastify: FastifyInstance,
  overrides: SubscriptionOverrides = {},
): Promise<OpenInvoiceFixture> {
  const fixture = await makeSubscription(fastify, overrides);
  const draft = await fastify.invoiceService.createInvoice(
    { subscriptionId: fixture.subscriptionId },
    TEST_LIVEMODE,
  );
  const open = await fastify.invoiceService.finalizeInvoice(draft.id);

  return { ...fixture, invoiceId: open.id };
}
