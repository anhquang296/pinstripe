import type { Currency } from '@utils/currency';
import type { FastifyBaseLogger } from 'fastify';
import _ from 'lodash';

const DEFAULT_REFERENCE_PREFIX = 'mockpsp';
const REFERENCE_RANDOM_LENGTH = 16;

export enum PspFailureCodeEnum {
  CARD_DECLINED = 'card_declined',
  INSUFFICIENT_FUNDS = 'insufficient_funds',
  PROCESSING_ERROR = 'processing_error',
}
export type PspFailureCode = `${PspFailureCodeEnum}`;

const FAILURE_BY_PAYMENT_METHOD: Record<string, PspFailureCode> = {
  pm_card_declined: PspFailureCodeEnum.CARD_DECLINED,
  pm_card_insufficient_funds: PspFailureCodeEnum.INSUFFICIENT_FUNDS,
  pm_card_error: PspFailureCodeEnum.PROCESSING_ERROR,
};

const FAILURE_MESSAGES: Record<PspFailureCode, string> = {
  [PspFailureCodeEnum.CARD_DECLINED]: 'The card was declined by the issuer',
  [PspFailureCodeEnum.INSUFFICIENT_FUNDS]: 'The card has insufficient funds',
  [PspFailureCodeEnum.PROCESSING_ERROR]: 'The processor could not complete the charge',
};

export type MockPspConfig = {
  referencePrefix?: string;
};

export interface PspChargeRequest {
  paymentMethod: string;
  amount: number;
  currency: Currency;
  idempotencyKey: string;
}

export interface PspChargeResult {
  isApproved: boolean;
  reference: string;
  failureCode: PspFailureCode | null;
  failureMessage: string | null;
}

export interface PspRefundRequest {
  reference: string;
  amount: number;
  currency: Currency;
  idempotencyKey: string;
}

export interface PspRefundResult {
  reference: string;
}

export class MockPspChargeNotFoundError extends Error {
  constructor(reference: string) {
    super(`The processor has no charge with reference ${reference}`);
    this.name = 'MockPspChargeNotFoundError';
  }
}

export class MockPspRefundTooLargeError extends Error {
  constructor(reference: string, refundable: number) {
    super(`Charge ${reference} has only ${refundable} left to refund`);
    this.name = 'MockPspRefundTooLargeError';
  }
}

interface MockPspCharge {
  reference: string;
  amount: number;
  currency: Currency;
  refunded: number;
}

export class MockPspClient {
  private _referencePrefix: string;
  private _logger: FastifyBaseLogger;
  private _chargesByReference: Map<string, MockPspCharge>;
  private _referencesByIdempotencyKey: Map<string, string>;

  constructor(mockPspConfig: MockPspConfig, logger: FastifyBaseLogger) {
    const { referencePrefix } = mockPspConfig;

    this._referencePrefix = referencePrefix ?? DEFAULT_REFERENCE_PREFIX;
    this._logger = logger;
    this._chargesByReference = new Map();
    this._referencesByIdempotencyKey = new Map();
  }

  async createCharge(request: PspChargeRequest): Promise<PspChargeResult> {
    const replayedReference = this._referencesByIdempotencyKey.get(request.idempotencyKey);

    if (replayedReference) {
      this._logger.info(
        { reference: replayedReference },
        '[MockPspClient] createCharge() replayed a known idempotency key',
      );

      return {
        isApproved: true,
        reference: replayedReference,
        failureCode: null,
        failureMessage: null,
      };
    }

    const failureCode = FAILURE_BY_PAYMENT_METHOD[request.paymentMethod];

    if (failureCode) {
      this._logger.info(
        { failureCode },
        '[MockPspClient] createCharge() declined by the simulated processor',
      );

      return {
        isApproved: false,
        reference: this.buildReference(),
        failureCode,
        failureMessage: FAILURE_MESSAGES[failureCode],
      };
    }

    const reference = this.buildReference();

    this._chargesByReference.set(reference, {
      reference,
      amount: request.amount,
      currency: request.currency,
      refunded: 0,
    });
    this._referencesByIdempotencyKey.set(request.idempotencyKey, reference);

    this._logger.info({ reference }, '[MockPspClient] createCharge() approved');

    return { isApproved: true, reference, failureCode: null, failureMessage: null };
  }

  async createRefund(request: PspRefundRequest): Promise<PspRefundResult> {
    const replayedReference = this._referencesByIdempotencyKey.get(request.idempotencyKey);

    if (replayedReference) {
      return { reference: replayedReference };
    }

    const charge = this._chargesByReference.get(request.reference);

    if (charge) {
      const refundable = charge.amount - charge.refunded;

      if (request.amount > refundable) {
        throw new MockPspRefundTooLargeError(request.reference, refundable);
      }

      const reference = this.buildReference();

      charge.refunded += request.amount;
      this._referencesByIdempotencyKey.set(request.idempotencyKey, reference);

      this._logger.info(
        { reference, chargeReference: request.reference },
        '[MockPspClient] createRefund() completed',
      );

      return { reference };
    }

    throw new MockPspChargeNotFoundError(request.reference);
  }

  private buildReference(): string {
    return `${this._referencePrefix}_${_.times(REFERENCE_RANDOM_LENGTH, () => {
      return _.random(35).toString(36);
    }).join('')}`;
  }
}
