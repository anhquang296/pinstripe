import type { Logger } from '@type/logger';
import type {
  OperatorCollectionPayload,
  OperatorCollectionProvider,
  OperatorCollectionResult,
} from '@type/operator-collection-provider';
import _ from 'lodash';

const DEFAULT_REFERENCE_PREFIX = 'mockvxr';

export enum MockVexereSourceEnum {
  TICKET_SALES = 'ticket_sales',
  WALLET = 'wallet',
}
export type MockVexereSource = `${MockVexereSourceEnum}`;

export type MockVexereConfig = {
  referencePrefix?: string;
};

export class MockVexereClient implements OperatorCollectionProvider {
  private _referencePrefix: string;
  private _logger: Logger;
  private _balancesBySource: Record<MockVexereSource, Map<string, number>>;
  private _collectionsByIdempotencyKey: Map<string, OperatorCollectionResult>;

  constructor(mockVexereConfig: MockVexereConfig, logger: Logger) {
    const { referencePrefix = DEFAULT_REFERENCE_PREFIX } = mockVexereConfig;

    this._referencePrefix = referencePrefix;
    this._logger = logger;
    this._balancesBySource = {
      [MockVexereSourceEnum.TICKET_SALES]: new Map(),
      [MockVexereSourceEnum.WALLET]: new Map(),
    };
    this._collectionsByIdempotencyKey = new Map();
  }

  async offsetTicketSales(payload: OperatorCollectionPayload): Promise<OperatorCollectionResult> {
    return this.collect(MockVexereSourceEnum.TICKET_SALES, payload);
  }

  async debitWallet(payload: OperatorCollectionPayload): Promise<OperatorCollectionResult> {
    return this.collect(MockVexereSourceEnum.WALLET, payload);
  }

  fundOperator(source: MockVexereSource, operatorId: string, amount: number): void {
    this._balancesBySource[source].set(operatorId, amount);
  }

  resolveOperatorBalance(source: MockVexereSource, operatorId: string): number {
    const balance = this._balancesBySource[source].get(operatorId);

    if (balance) {
      return balance;
    }

    return 0;
  }

  private collect(
    source: MockVexereSource,
    payload: OperatorCollectionPayload,
  ): OperatorCollectionResult {
    const replayedCollection = this._collectionsByIdempotencyKey.get(payload.idempotencyKey);

    if (replayedCollection) {
      return replayedCollection;
    }

    const balance = this.resolveOperatorBalance(source, payload.operatorId);
    const appliedAmount = _.clamp(payload.amount, 0, balance);
    const reference =
      appliedAmount > 0 ? `${this._referencePrefix}_${payload.idempotencyKey}` : null;
    const collection = { appliedAmount, reference };

    this._balancesBySource[source].set(payload.operatorId, balance - appliedAmount);
    this._collectionsByIdempotencyKey.set(payload.idempotencyKey, collection);

    this._logger.info(
      { source, operatorId: payload.operatorId, requestedAmount: payload.amount, appliedAmount },
      '[MockVexereClient] collect() completed',
    );

    return collection;
  }
}
