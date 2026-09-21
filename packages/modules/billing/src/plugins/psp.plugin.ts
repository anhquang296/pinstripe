import { MockPspClient } from '@clients/mock-psp.client';
import fp from 'fastify-plugin';

export const pspPlugin = fp(async (fastify) => {
  const { PSP_REFERENCE_PREFIX, PSP_AUTHENTICATION_URL } = fastify.billingConfig;

  fastify.decorate(
    'psp',
    new MockPspClient(
      { referencePrefix: PSP_REFERENCE_PREFIX, authenticationUrl: PSP_AUTHENTICATION_URL },
      fastify.log,
    ),
  );
});
