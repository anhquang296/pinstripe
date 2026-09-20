import type { MockVexereBalance, MockVexereSource } from '@clients/mock-vexere.client';
import { MockVexereClient, MockVexereSourceEnum } from '@clients/mock-vexere.client';
import { VexereClient } from '@clients/vexere.client';
import type { PartnerPlatform } from '@contracts/customers.types';
import { PartnerPlatformEnum } from '@contracts/customers.types';
import type { PartnerCollectionProvider } from '@type/partner-collection-provider';
import fp from 'fastify-plugin';
import _ from 'lodash';

const BALANCE_FIELD_COUNT = 3;

function isMockVexereSource(value: string): value is MockVexereSource {
  return _.includes(_.values(MockVexereSourceEnum), value);
}

function parseMockVexereBalances(value: string | undefined): MockVexereBalance[] {
  if (!value) {
    return [];
  }

  const entries = _(value)
    .split(',')
    .map(_.trim)
    .reject(_.isEmpty)
    .map((entry) => {
      return _.split(entry, ':');
    })
    .value();

  const balances: MockVexereBalance[] = [];

  for (const [source, partnerAccountId, amount] of entries) {
    const parsedAmount = Number(amount);

    const isUsable =
      _.size([source, partnerAccountId, amount]) === BALANCE_FIELD_COUNT &&
      source &&
      isMockVexereSource(source) &&
      partnerAccountId &&
      Number.isSafeInteger(parsedAmount) &&
      parsedAmount >= 0;

    if (isUsable) {
      balances.push({ source, partnerAccountId, amount: parsedAmount });
    }
  }

  return balances;
}

export const partnerCollectionPlugin = fp(async (fastify) => {
  const { VEXERE_API_URL, VEXERE_API_KEY, VEXERE_TIMEOUT_MS, MOCK_VEXERE_BALANCES } =
    fastify.config;

  const vexereConfig = {
    apiUrl: VEXERE_API_URL,
    apiKey: VEXERE_API_KEY,
    timeoutMs: VEXERE_TIMEOUT_MS,
  };

  const balances = parseMockVexereBalances(MOCK_VEXERE_BALANCES);

  const vexereProvider: PartnerCollectionProvider = VexereClient.isConfigured(vexereConfig)
    ? new VexereClient(vexereConfig, fastify.log)
    : new MockVexereClient({ balances }, fastify.log);

  const partnerCollectionProviders: Record<PartnerPlatform, PartnerCollectionProvider> = {
    [PartnerPlatformEnum.VEXERE]: vexereProvider,
  };

  fastify.decorate('partnerCollectionProviders', partnerCollectionProviders);
});
