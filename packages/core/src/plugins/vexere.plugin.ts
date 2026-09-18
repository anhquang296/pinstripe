import { MockVexereClient } from '@clients/mock-vexere.client';
import { VexereClient } from '@clients/vexere.client';
import type { OperatorCollectionProvider } from '@type/operator-collection-provider';
import fp from 'fastify-plugin';

export const vexerePlugin = fp(async (fastify) => {
  const { VEXERE_API_URL, VEXERE_API_KEY, VEXERE_TIMEOUT_MS } = fastify.config;

  const vexereConfig = {
    apiUrl: VEXERE_API_URL,
    apiKey: VEXERE_API_KEY,
    timeoutMs: VEXERE_TIMEOUT_MS,
  };

  const operatorCollectionProvider: OperatorCollectionProvider = VexereClient.isConfigured(
    vexereConfig,
  )
    ? new VexereClient(vexereConfig, fastify.log)
    : new MockVexereClient({}, fastify.log);

  fastify.decorate('operatorCollectionProvider', operatorCollectionProvider);
});
