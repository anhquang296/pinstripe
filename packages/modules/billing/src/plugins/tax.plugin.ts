import { TableTaxProvider } from '@clients/table-tax-provider';
import fp from 'fastify-plugin';

export const taxPlugin = fp(async (fastify) => {
  fastify.decorate(
    'taxProvider',
    new TableTaxProvider({ taxRateRepository: fastify.taxRateRepository }, fastify.log),
  );
});
