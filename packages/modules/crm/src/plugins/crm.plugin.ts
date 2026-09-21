import { AggregateTypeEnum } from '@vxrerp/platform/contracts';
import fp from 'fastify-plugin';

export const crmPlugin = fp(async (fastify) => {
  fastify.domainEventDispatchService.registerDomainEventHandler({
    name: 'crm.customer-activity',
    aggregateTypes: [AggregateTypeEnum.CUSTOMER],
    handle: async (event) => {
      const { eventId, eventType, aggregateId } = event;

      fastify.log.info(
        { eventId, eventType, customerId: aggregateId },
        'handleCustomerActivity() customer event received',
      );
    },
  });
});
