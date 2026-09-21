import { EntitlementStatusEnum } from '@contracts/entitlements.types';
import { RecurringIntervalEnum } from '@contracts/prices.types';
import { CurrencyEnum } from '@utils/currency';
import { AggregateTypeEnum, DomainEventTypeEnum } from '@vxrerp/platform/contracts';
import { generateGid, ObjectPrefixEnum } from '@vxrerp/platform/utils';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';
import { afterAll, beforeAll, expect, it } from 'vitest';

import { buildTestContext } from './context';

let fastify: FastifyInstance;

beforeAll(async () => {
  fastify = await buildTestContext();
});

afterAll(async () => {
  await fastify.close();
});

async function createSubscribedCustomer(): Promise<{ customerId: string; subscriptionId: string }> {
  const customer = await fastify.customerService.createCustomer({
    email: `${generateGid(ObjectPrefixEnum.CUSTOMER)}@example.test`,
    currency: CurrencyEnum.VND,
  });

  const product = await fastify.productService.createProduct({
    name: `Plan ${generateGid(ObjectPrefixEnum.PRODUCT)}`,
  });

  const price = await fastify.priceService.createPrice({
    productId: product.id,
    currency: CurrencyEnum.VND,
    unitAmount: 500_000,
    recurring: { interval: RecurringIntervalEnum.MONTH },
  });

  const subscription = await fastify.subscriptionService.createSubscription({
    customerId: customer.id,
    items: [{ priceId: price.id }],
  });

  return { customerId: customer.id, subscriptionId: subscription.id };
}

it('syncs entitlements through the billing handler when a subscription event is dispatched', async () => {
  const { customerId, subscriptionId } = await createSubscribedCustomer();

  await fastify.domainEventDispatchService.handleDomainEvent({
    eventId: generateGid(ObjectPrefixEnum.EVENT),
    eventType: DomainEventTypeEnum.SUBSCRIPTION_CREATED,
    aggregateType: AggregateTypeEnum.SUBSCRIPTION,
    aggregateId: subscriptionId,
    payload: {},
    occurredAt: new Date().toISOString(),
  });

  const entitlements = await fastify.entitlementService.findEntitlements({ customerId });

  expect(_.get(entitlements.data, '0.status')).toBe(EntitlementStatusEnum.ACTIVE);
});
