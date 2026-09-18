import { MockVexereClient } from '@clients/mock-vexere.client';
import { VexereClient } from '@clients/vexere.client';
import type { PartnerPlatform } from '@contracts/customers.types';
import { PartnerPlatformEnum } from '@contracts/customers.types';
import type { PartnerCollectionProvider } from '@type/partner-collection-provider';
import fp from 'fastify-plugin';

export const partnerCollectionPlugin = fp(async (fastify) => {
  const { VEXERE_API_URL, VEXERE_API_KEY, VEXERE_TIMEOUT_MS } = fastify.config;

  const vexereConfig = {
    apiUrl: VEXERE_API_URL,
    apiKey: VEXERE_API_KEY,
    timeoutMs: VEXERE_TIMEOUT_MS,
  };

  const vexereProvider: PartnerCollectionProvider = VexereClient.isConfigured(vexereConfig)
    ? new VexereClient(vexereConfig, fastify.log)
    : new MockVexereClient({}, fastify.log);

  const partnerCollectionProviders: Record<PartnerPlatform, PartnerCollectionProvider> = {
    [PartnerPlatformEnum.VEXERE]: vexereProvider,
  };

  fastify.decorate('partnerCollectionProviders', partnerCollectionProviders);
});
