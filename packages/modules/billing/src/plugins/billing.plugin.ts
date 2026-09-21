import { billingConfigPlugin } from '@plugins/billing-config.plugin';
import { billingDomainEventPlugin } from '@plugins/billing-domain-event.plugin';
import { billingRepositoryRegistryPlugin } from '@plugins/billing-repository-registry.plugin';
import { billingServiceRegistryPlugin } from '@plugins/billing-service-registry.plugin';
import { partnerCollectionPlugin } from '@plugins/partner-collection.plugin';
import { pspPlugin } from '@plugins/psp.plugin';
import { taxPlugin } from '@plugins/tax.plugin';
import fp from 'fastify-plugin';

export const billingPlugin = fp(async (fastify) => {
  await fastify.register(billingConfigPlugin);
  await fastify.register(pspPlugin);
  await fastify.register(billingRepositoryRegistryPlugin);
  await fastify.register(taxPlugin);
  await fastify.register(partnerCollectionPlugin);
  await fastify.register(billingServiceRegistryPlugin);
  await fastify.register(billingDomainEventPlugin);
});
