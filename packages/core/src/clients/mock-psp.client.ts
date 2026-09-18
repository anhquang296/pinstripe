import type { PaymentMethodCard, PaymentMethodType } from '@contracts/payment-methods.types';
import { CardFundingEnum, PaymentMethodTypeEnum } from '@contracts/payment-methods.types';
import type {
  CaptureMethod,
  DeclineCode,
  FailureCode,
  NextAction,
  PaymentMethodDetails,
  PspCallbackPayload,
} from '@contracts/payments.types';
import {
  CaptureMethodEnum,
  DeclineCodeEnum,
  FailureCodeEnum,
  NextActionTypeEnum,
  PspEventTypeEnum,
} from '@contracts/payments.types';
import type { Currency } from '@utils/currency';
import type { FastifyBaseLogger } from 'fastify';
import _ from 'lodash';

const DEFAULT_REFERENCE_PREFIX = 'mockpsp';
const DEFAULT_AUTHENTICATION_URL = 'https://mock-psp.test/3ds';
const REFERENCE_RANDOM_LENGTH = 16;

export enum PspTokenEnum {
  VISA_OK = 'tok_visa_ok',
  VISA_3DS = 'tok_visa_3ds',
  CARD_DECLINED = 'tok_card_declined',
  CARD_INSUFFICIENT_FUNDS = 'tok_card_insufficient_funds',
  CARD_EXPIRED = 'tok_card_expired',
  CARD_LOST = 'tok_card_lost',
  CARD_STOLEN = 'tok_card_stolen',
  CARD_ERROR = 'tok_card_error',
  BANK_OK = 'tok_bank_ok',
  WALLET_OK = 'tok_wallet_ok',
}
export type PspToken = `${PspTokenEnum}`;

export enum PspIntentStatusEnum {
  PROCESSING = 'processing',
  REQUIRES_ACTION = 'requires_action',
}
export type PspIntentStatus = `${PspIntentStatusEnum}`;

interface TokenBehaviour {
  type: PaymentMethodType;
  card: PaymentMethodCard | null;
  requiresAuthentication: boolean;
  failureCode: FailureCode | null;
  declineCode: DeclineCode | null;
  failureMessage: string | null;
}

function buildCard(
  last4: string,
  expYear: number,
  overrides: Partial<PaymentMethodCard> = {},
): PaymentMethodCard {
  return {
    brand: 'visa',
    last4,
    expMonth: 12,
    expYear,
    fingerprint: `fp_${last4}`,
    funding: CardFundingEnum.CREDIT,
    country: 'VN',
    ...overrides,
  };
}

const CARD_EXPIRY_YEAR = 2030;
const EXPIRED_CARD_YEAR = 2020;

const TOKEN_BEHAVIOURS: Record<PspToken, TokenBehaviour> = {
  [PspTokenEnum.VISA_OK]: {
    type: PaymentMethodTypeEnum.CARD,
    card: buildCard('4242', CARD_EXPIRY_YEAR),
    requiresAuthentication: false,
    failureCode: null,
    declineCode: null,
    failureMessage: null,
  },
  [PspTokenEnum.VISA_3DS]: {
    type: PaymentMethodTypeEnum.CARD,
    card: buildCard('3155', CARD_EXPIRY_YEAR),
    requiresAuthentication: true,
    failureCode: null,
    declineCode: null,
    failureMessage: null,
  },
  [PspTokenEnum.CARD_DECLINED]: {
    type: PaymentMethodTypeEnum.CARD,
    card: buildCard('0002', CARD_EXPIRY_YEAR),
    requiresAuthentication: false,
    failureCode: FailureCodeEnum.CARD_DECLINED,
    declineCode: DeclineCodeEnum.GENERIC_DECLINE,
    failureMessage: 'The card was declined by the issuer',
  },
  [PspTokenEnum.CARD_INSUFFICIENT_FUNDS]: {
    type: PaymentMethodTypeEnum.CARD,
    card: buildCard('9995', CARD_EXPIRY_YEAR),
    requiresAuthentication: false,
    failureCode: FailureCodeEnum.CARD_DECLINED,
    declineCode: DeclineCodeEnum.INSUFFICIENT_FUNDS,
    failureMessage: 'The card has insufficient funds',
  },
  [PspTokenEnum.CARD_EXPIRED]: {
    type: PaymentMethodTypeEnum.CARD,
    card: buildCard('0069', EXPIRED_CARD_YEAR),
    requiresAuthentication: false,
    failureCode: FailureCodeEnum.EXPIRED_CARD,
    declineCode: DeclineCodeEnum.EXPIRED_CARD,
    failureMessage: 'The card has expired',
  },
  [PspTokenEnum.CARD_LOST]: {
    type: PaymentMethodTypeEnum.CARD,
    card: buildCard('9987', CARD_EXPIRY_YEAR),
    requiresAuthentication: false,
    failureCode: FailureCodeEnum.CARD_DECLINED,
    declineCode: DeclineCodeEnum.LOST_CARD,
    failureMessage: 'The card has been reported lost',
  },
  [PspTokenEnum.CARD_STOLEN]: {
    type: PaymentMethodTypeEnum.CARD,
    card: buildCard('9979', CARD_EXPIRY_YEAR),
    requiresAuthentication: false,
    failureCode: FailureCodeEnum.CARD_DECLINED,
    declineCode: DeclineCodeEnum.STOLEN_CARD,
    failureMessage: 'The card has been reported stolen',
  },
  [PspTokenEnum.CARD_ERROR]: {
    type: PaymentMethodTypeEnum.CARD,
    card: buildCard('0119', CARD_EXPIRY_YEAR),
    requiresAuthentication: false,
    failureCode: FailureCodeEnum.PROCESSING_ERROR,
    declineCode: DeclineCodeEnum.PROCESSING_ERROR,
    failureMessage: 'The processor could not complete the charge',
  },
  [PspTokenEnum.BANK_OK]: {
    type: PaymentMethodTypeEnum.BANK_ACCOUNT,
    card: null,
    requiresAuthentication: false,
    failureCode: null,
    declineCode: null,
    failureMessage: null,
  },
  [PspTokenEnum.WALLET_OK]: {
    type: PaymentMethodTypeEnum.WALLET,
    card: null,
    requiresAuthentication: false,
    failureCode: null,
    declineCode: null,
    failureMessage: null,
  },
};

export type MockPspConfig = {
  referencePrefix?: string;
  authenticationUrl?: string;
};

export interface PspTokenizePayload {
  token: string;
  type: PaymentMethodType;
}

export interface PspTokenizeResult {
  card: PaymentMethodCard | null;
  paymentMethodDetails: PaymentMethodDetails;
}

export interface PspConfirmPaymentPayload {
  token: string;
  amount: number;
  currency: Currency;
  captureMethod: CaptureMethod;
  idempotencyKey: string;
}

export interface PspConfirmResult {
  reference: string;
  status: PspIntentStatus;
  nextAction: NextAction | null;
}

export interface PspCapturePaymentPayload {
  reference: string;
  amount: number;
  idempotencyKey: string;
}

export interface PspConfirmSetupPayload {
  token: string;
  idempotencyKey: string;
}

export interface PspRefundPayload {
  reference: string;
  amount: number;
  currency: Currency;
  idempotencyKey: string;
}

export interface PspRefundResult {
  reference: string;
}

export class MockPspUnknownTokenError extends Error {
  constructor(token: string) {
    super(`The processor does not recognise token ${token}`);
    this.name = 'MockPspUnknownTokenError';
  }
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

interface MockPspPayment {
  reference: string;
  token: PspToken;
  amount: number;
  currency: Currency;
  captureMethod: CaptureMethod;
  captured: number;
  refunded: number;
}

interface MockPspSetup {
  reference: string;
  token: PspToken;
}

export class MockPspClient {
  private _referencePrefix: string;
  private _authenticationUrl: string;
  private _logger: FastifyBaseLogger;
  private _paymentsByReference: Map<string, MockPspPayment>;
  private _setupsByReference: Map<string, MockPspSetup>;
  private _confirmationsByIdempotencyKey: Map<string, PspConfirmResult>;
  private _refundsByIdempotencyKey: Map<string, string>;
  private _pendingEvents: PspCallbackPayload[];

  constructor(mockPspConfig: MockPspConfig, logger: FastifyBaseLogger) {
    const { referencePrefix, authenticationUrl } = mockPspConfig;

    this._referencePrefix = referencePrefix ?? DEFAULT_REFERENCE_PREFIX;
    this._authenticationUrl = authenticationUrl ?? DEFAULT_AUTHENTICATION_URL;
    this._logger = logger;
    this._paymentsByReference = new Map();
    this._setupsByReference = new Map();
    this._confirmationsByIdempotencyKey = new Map();
    this._refundsByIdempotencyKey = new Map();
    this._pendingEvents = [];
  }

  async tokenize(payload: PspTokenizePayload): Promise<PspTokenizeResult> {
    const behaviour = MockPspClient.readBehaviour(payload.token);

    return {
      card: behaviour.card,
      paymentMethodDetails: { type: payload.type, token: payload.token },
    };
  }

  async confirmPayment(payload: PspConfirmPaymentPayload): Promise<PspConfirmResult> {
    const replayedConfirmation = this._confirmationsByIdempotencyKey.get(payload.idempotencyKey);

    if (replayedConfirmation) {
      this._logger.info(
        { reference: replayedConfirmation.reference },
        '[MockPspClient] confirmPayment() replayed a known idempotency key',
      );

      return replayedConfirmation;
    }

    const behaviour = MockPspClient.readBehaviour(payload.token);
    const reference = this.buildReference();

    this._paymentsByReference.set(reference, {
      reference,
      token: payload.token as PspToken,
      amount: payload.amount,
      currency: payload.currency,
      captureMethod: payload.captureMethod,
      captured: 0,
      refunded: 0,
    });

    const confirmation = behaviour.requiresAuthentication
      ? {
          reference,
          status: PspIntentStatusEnum.REQUIRES_ACTION,
          nextAction: {
            type: NextActionTypeEnum.REDIRECT_TO_URL,
            redirectUrl: `${this._authenticationUrl}/${reference}`,
          },
        }
      : { reference, status: PspIntentStatusEnum.PROCESSING, nextAction: null };

    this._confirmationsByIdempotencyKey.set(payload.idempotencyKey, confirmation);

    if (!behaviour.requiresAuthentication) {
      this.enqueuePaymentOutcome(reference);
    }

    this._logger.info(
      { reference, status: confirmation.status },
      '[MockPspClient] confirmPayment() accepted',
    );

    return confirmation;
  }

  async capturePayment(payload: PspCapturePaymentPayload): Promise<PspConfirmResult> {
    const replayedConfirmation = this._confirmationsByIdempotencyKey.get(payload.idempotencyKey);

    if (replayedConfirmation) {
      return replayedConfirmation;
    }

    const payment = this._paymentsByReference.get(payload.reference);

    if (!payment) {
      throw new MockPspChargeNotFoundError(payload.reference);
    }

    const confirmation = {
      reference: payment.reference,
      status: PspIntentStatusEnum.PROCESSING,
      nextAction: null,
    };

    this._confirmationsByIdempotencyKey.set(payload.idempotencyKey, confirmation);
    this._pendingEvents.push({
      id: this.buildEventId(),
      type: PspEventTypeEnum.PAYMENT_SUCCEEDED,
      reference: payment.reference,
      amount: payload.amount,
      paymentMethodDetails: { token: payment.token },
    });

    this._logger.info(
      { reference: payment.reference },
      '[MockPspClient] capturePayment() accepted',
    );

    return confirmation;
  }

  async confirmSetup(payload: PspConfirmSetupPayload): Promise<PspConfirmResult> {
    const replayedConfirmation = this._confirmationsByIdempotencyKey.get(payload.idempotencyKey);

    if (replayedConfirmation) {
      return replayedConfirmation;
    }

    const behaviour = MockPspClient.readBehaviour(payload.token);
    const reference = this.buildReference();

    this._setupsByReference.set(reference, { reference, token: payload.token as PspToken });

    const confirmation = behaviour.requiresAuthentication
      ? {
          reference,
          status: PspIntentStatusEnum.REQUIRES_ACTION,
          nextAction: {
            type: NextActionTypeEnum.REDIRECT_TO_URL,
            redirectUrl: `${this._authenticationUrl}/${reference}`,
          },
        }
      : { reference, status: PspIntentStatusEnum.PROCESSING, nextAction: null };

    this._confirmationsByIdempotencyKey.set(payload.idempotencyKey, confirmation);

    if (!behaviour.requiresAuthentication) {
      this.enqueueSetupOutcome(reference);
    }

    return confirmation;
  }

  async createRefund(payload: PspRefundPayload): Promise<PspRefundResult> {
    const replayedReference = this._refundsByIdempotencyKey.get(payload.idempotencyKey);

    if (replayedReference) {
      return { reference: replayedReference };
    }

    const payment = this._paymentsByReference.get(payload.reference);

    if (!payment) {
      throw new MockPspChargeNotFoundError(payload.reference);
    }

    const refundable = payment.amount - payment.refunded;

    if (payload.amount > refundable) {
      throw new MockPspRefundTooLargeError(payload.reference, refundable);
    }

    const reference = this.buildReference();

    payment.refunded += payload.amount;
    this._refundsByIdempotencyKey.set(payload.idempotencyKey, reference);

    this._logger.info(
      { reference, chargeReference: payload.reference },
      '[MockPspClient] createRefund() completed',
    );

    return { reference };
  }

  completeAuthentication(reference: string): void {
    if (this._setupsByReference.has(reference)) {
      this.enqueueSetupOutcome(reference);

      return;
    }

    if (this._paymentsByReference.has(reference)) {
      this.enqueuePaymentOutcome(reference);

      return;
    }

    throw new MockPspChargeNotFoundError(reference);
  }

  takePendingEvents(): PspCallbackPayload[] {
    const taken = this._pendingEvents;

    this._pendingEvents = [];

    return taken;
  }

  private enqueuePaymentOutcome(reference: string): void {
    const payment = this._paymentsByReference.get(reference);

    if (!payment) {
      throw new MockPspChargeNotFoundError(reference);
    }

    const behaviour = MockPspClient.readBehaviour(payment.token);

    if (behaviour.failureCode) {
      this._pendingEvents.push({
        id: this.buildEventId(),
        type: PspEventTypeEnum.PAYMENT_FAILED,
        reference,
        failureCode: behaviour.failureCode,
        declineCode: behaviour.declineCode ?? DeclineCodeEnum.GENERIC_DECLINE,
        failureMessage: behaviour.failureMessage ?? 'The payment could not be completed',
        paymentMethodDetails: { token: payment.token },
      });

      return;
    }

    const isManual = payment.captureMethod === CaptureMethodEnum.MANUAL;

    if (!isManual) {
      payment.captured = payment.amount;
    }

    this._pendingEvents.push({
      id: this.buildEventId(),
      type: isManual ? PspEventTypeEnum.PAYMENT_AUTHORIZED : PspEventTypeEnum.PAYMENT_SUCCEEDED,
      reference,
      amount: payment.amount,
      paymentMethodDetails: { token: payment.token },
    });
  }

  private enqueueSetupOutcome(reference: string): void {
    const setup = this._setupsByReference.get(reference);

    if (!setup) {
      throw new MockPspChargeNotFoundError(reference);
    }

    const behaviour = MockPspClient.readBehaviour(setup.token);

    if (behaviour.failureCode) {
      this._pendingEvents.push({
        id: this.buildEventId(),
        type: PspEventTypeEnum.SETUP_FAILED,
        reference,
        failureCode: behaviour.failureCode,
        declineCode: behaviour.declineCode ?? DeclineCodeEnum.GENERIC_DECLINE,
        failureMessage: behaviour.failureMessage ?? 'The card could not be saved',
      });

      return;
    }

    this._pendingEvents.push({
      id: this.buildEventId(),
      type: PspEventTypeEnum.SETUP_SUCCEEDED,
      reference,
      paymentMethodDetails: { token: setup.token },
    });
  }

  private buildEventId(): string {
    return `${this._referencePrefix}_evt_${MockPspClient.buildRandomSuffix()}`;
  }

  private buildReference(): string {
    return `${this._referencePrefix}_${MockPspClient.buildRandomSuffix()}`;
  }

  private static buildRandomSuffix(): string {
    return _.times(REFERENCE_RANDOM_LENGTH, () => {
      return _.random(35).toString(36);
    }).join('');
  }

  private static readBehaviour(token: string): TokenBehaviour {
    const behaviour = _.get(TOKEN_BEHAVIOURS, token);

    if (behaviour) {
      return behaviour;
    }

    throw new MockPspUnknownTokenError(token);
  }
}
