import type {
  PartnerCollectionPayload,
  PartnerCollectionProvider,
  PartnerCollectionResult,
} from '@type/partner-collection-provider';
import type { Logger } from '@vxrerp/platform/types';
import _ from 'lodash';

const DEFAULT_REFERENCE_PREFIX = 'mockvxr';

export enum MockVexereSourceEnum {
  TICKET_SALES = 'ticket_sales',
  WALLET = 'wallet',
}
export type MockVexereSource = `${MockVexereSourceEnum}`;

export type MockVexereBalance = {
  source: MockVexereSource;
  partnerAccountId: string;
  amount: number;
};

export type MockVexereConfig = {
  referencePrefix?: string;
  balances?: readonly MockVexereBalance[];
};

export class MockVexereClient implements PartnerCollectionProvider {
  private _referencePrefix: string;
  private _logger: Logger;
  private _balancesBySource: Record<MockVexereSource, Map<string, number>>;
  private _collectionsByIdempotencyKey: Map<string, PartnerCollectionResult>;

  constructor(mockVexereConfig: MockVexereConfig, logger: Logger) {
    const { referencePrefix = DEFAULT_REFERENCE_PREFIX, balances = [] } = mockVexereConfig;

    this._referencePrefix = referencePrefix;
    this._logger = logger;
    this._balancesBySource = {
      [MockVexereSourceEnum.TICKET_SALES]: new Map(),
      [MockVexereSourceEnum.WALLET]: new Map(),
    };
    this._collectionsByIdempotencyKey = new Map();

    for (const balance of balances) {
      this.fundAccount(balance.source, balance.partnerAccountId, balance.amount);
    }
  }

  async offsetTicketSales(payload: PartnerCollectionPayload): Promise<PartnerCollectionResult> {
    return this.collect(MockVexereSourceEnum.TICKET_SALES, payload);
  }

  async debitWallet(payload: PartnerCollectionPayload): Promise<PartnerCollectionResult> {
    return this.collect(MockVexereSourceEnum.WALLET, payload);
  }

  fundAccount(source: MockVexereSource, partnerAccountId: string, amount: number): void {
    this._balancesBySource[source].set(partnerAccountId, amount);
  }

  resolveAccountBalance(source: MockVexereSource, partnerAccountId: string): number {
    const balance = this._balancesBySource[source].get(partnerAccountId);

    if (balance) {
      return balance;
    }

    return 0;
  }

  private collect(
    source: MockVexereSource,
    payload: PartnerCollectionPayload,
  ): PartnerCollectionResult {
    const replayedCollection = this._collectionsByIdempotencyKey.get(payload.idempotencyKey);

    if (replayedCollection) {
      return replayedCollection;
    }

    const { partnerAccountId, amount, idempotencyKey } = payload;

    const balance = this.resolveAccountBalance(source, partnerAccountId);
    const appliedAmount = _.clamp(amount, 0, balance);
    const reference = appliedAmount > 0 ? `${this._referencePrefix}_${idempotencyKey}` : null;
    const collection = { appliedAmount, reference };

    this._balancesBySource[source].set(partnerAccountId, balance - appliedAmount);
    this._collectionsByIdempotencyKey.set(idempotencyKey, collection);

    this._logger.info(
      { source, partnerAccountId, requestedAmount: amount, appliedAmount },
      '[MockVexereClient] collect() completed',
    );

    return collection;
  }
}
