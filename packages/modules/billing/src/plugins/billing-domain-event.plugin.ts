import { AggregateTypeEnum } from '@vxrerp/platform/contracts';
import fp from 'fastify-plugin';

export const billingDomainEventPlugin = fp(async (fastify) => {
  fastify.domainEventDispatchService.registerDomainEventHandler({
    name: 'billing.entitlement-sync',
    aggregateTypes: [AggregateTypeEnum.SUBSCRIPTION],
    handle: async (event) => {
      await fastify.entitlementService.handleSubscriptionChanged(event.aggregateId);
    },
  });
});
