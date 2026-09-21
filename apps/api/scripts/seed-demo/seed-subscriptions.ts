import { BillingModeEnum } from '@vxrerp/billing/contracts';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

import type { SeededCatalog, SeededOperator } from './seed-demo.types';

export async function seedSubscriptions(
  fastify: FastifyInstance,
  catalog: SeededCatalog,
  operators: readonly SeededOperator[],
): Promise<SeededOperator[]> {
  const seeded: SeededOperator[] = [];

  for (const { operator, customerId } of operators) {
    const items = _.map(operator.items, (item) => {
      return {
        priceId: catalog.priceIdByKey[item.priceKey],
        quantity: item.quantity,
        taxRates: [catalog.taxRateId],
      };
    });

    const subscription = await fastify.subscriptionService.createSubscription({
      customerId,
      items,
      collectionMethod: operator.collectionMethod,
      billingMode: BillingModeEnum.ARREARS,
      defaultTaxRates: [catalog.taxRateId],
      trialPeriodDays: operator.trialPeriodDays,
    });

    seeded.push({ operator, customerId, subscriptionId: subscription.id });
  }

  return seeded;
}
