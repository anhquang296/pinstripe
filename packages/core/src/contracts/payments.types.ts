import type { Static } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';
import type { Currency } from '@utils/currency';
import { CurrencyEnum } from '@utils/currency';

export enum PaymentIntentStatusEnum {
  REQUIRES_PAYMENT_METHOD = 'requires_payment_method',
  REQUIRES_CONFIRMATION = 'requires_confirmation',
  REQUIRES_ACTION = 'requires_action',
  PROCESSING = 'processing',
  REQUIRES_CAPTURE = 'requires_capture',
  SUCCEEDED = 'succeeded',
  CANCELED = 'canceled',
}
export type PaymentIntentStatus = `${PaymentIntentStatusEnum}`;

export enum CaptureMethodEnum {
  AUTOMATIC = 'automatic',
  MANUAL = 'manual',
}
export type CaptureMethod = `${CaptureMethodEnum}`;

export enum PaymentCancellationReasonEnum {
  REQUESTED_BY_CUSTOMER = 'requested_by_customer',
  DUPLICATE = 'duplicate',
  FRAUDULENT = 'fraudulent',
  ABANDONED = 'abandoned',
  FAILED_INVOICE = 'failed_invoice',
}
export type PaymentCancellationReason = `${PaymentCancellationReasonEnum}`;

export enum NextActionTypeEnum {
  REDIRECT_TO_URL = 'redirect_to_url',
  USE_STRIPE_SDK = 'use_stripe_sdk',
}
export type NextActionType = `${NextActionTypeEnum}`;

export enum ChargeStatusEnum {
  PENDING = 'pending',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
}
export type ChargeStatus = `${ChargeStatusEnum}`;

export enum ChargeOutcomeEnum {
  APPROVED = 'approved',
  AUTHORIZED = 'authorized',
  DECLINED = 'declined',
  ERRORED = 'errored',
}
export type ChargeOutcome = `${ChargeOutcomeEnum}`;

export enum FailureCodeEnum {
  CARD_DECLINED = 'card_declined',
  EXPIRED_CARD = 'expired_card',
  INCORRECT_CVC = 'incorrect_cvc',
  PROCESSING_ERROR = 'processing_error',
  AUTHENTICATION_REQUIRED = 'authentication_required',
}
export type FailureCode = `${FailureCodeEnum}`;

export enum DeclineCodeEnum {
  INSUFFICIENT_FUNDS = 'insufficient_funds',
  GENERIC_DECLINE = 'generic_decline',
  DO_NOT_HONOR = 'do_not_honor',
  TRY_AGAIN_LATER = 'try_again_later',
  EXPIRED_CARD = 'expired_card',
  INCORRECT_CVC = 'incorrect_cvc',
  LOST_CARD = 'lost_card',
  STOLEN_CARD = 'stolen_card',
  FRAUDULENT = 'fraudulent',
  PICKUP_CARD = 'pickup_card',
  INVALID_ACCOUNT = 'invalid_account',
  CURRENCY_NOT_SUPPORTED = 'currency_not_supported',
  AUTHENTICATION_REQUIRED = 'authentication_required',
  PROCESSING_ERROR = 'processing_error',
}
export type DeclineCode = `${DeclineCodeEnum}`;

export enum DeclineKindEnum {
  SOFT = 'soft',
  HARD = 'hard',
}
export type DeclineKind = `${DeclineKindEnum}`;

export enum PspProviderEnum {
  MOCK = 'mock',
}
export type PspProvider = `${PspProviderEnum}`;

export enum PspEventTypeEnum {
  PAYMENT_SUCCEEDED = 'payment.succeeded',
  PAYMENT_AUTHORIZED = 'payment.authorized',
  PAYMENT_FAILED = 'payment.failed',
  SETUP_SUCCEEDED = 'setup.succeeded',
  SETUP_FAILED = 'setup.failed',
  REFUND_SUCCEEDED = 'refund.succeeded',
  REFUND_FAILED = 'refund.failed',
  DISPUTE_CREATED = 'dispute.created',
  DISPUTE_CLOSED = 'dispute.closed',
  PAYOUT_PAID = 'payout.paid',
  PAYOUT_FAILED = 'payout.failed',
}
export type PspEventType = `${PspEventTypeEnum}`;

export enum RefundStatusEnum {
  PENDING = 'pending',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  CANCELED = 'canceled',
}
export type RefundStatus = `${RefundStatusEnum}`;

export const REFUND_TRANSITIONS: Record<RefundStatus, RefundStatus[]> = {
  [RefundStatusEnum.PENDING]: [
    RefundStatusEnum.SUCCEEDED,
    RefundStatusEnum.FAILED,
    RefundStatusEnum.CANCELED,
  ],
  [RefundStatusEnum.SUCCEEDED]: [],
  [RefundStatusEnum.FAILED]: [],
  [RefundStatusEnum.CANCELED]: [],
};

export const PAYMENT_INTENT_TRANSITIONS: Record<PaymentIntentStatus, PaymentIntentStatus[]> = {
  [PaymentIntentStatusEnum.REQUIRES_PAYMENT_METHOD]: [
    PaymentIntentStatusEnum.REQUIRES_CONFIRMATION,
    PaymentIntentStatusEnum.PROCESSING,
    PaymentIntentStatusEnum.REQUIRES_ACTION,
    PaymentIntentStatusEnum.CANCELED,
  ],
  [PaymentIntentStatusEnum.REQUIRES_CONFIRMATION]: [
    PaymentIntentStatusEnum.PROCESSING,
    PaymentIntentStatusEnum.REQUIRES_ACTION,
    PaymentIntentStatusEnum.REQUIRES_PAYMENT_METHOD,
    PaymentIntentStatusEnum.CANCELED,
  ],
  [PaymentIntentStatusEnum.REQUIRES_ACTION]: [
    PaymentIntentStatusEnum.PROCESSING,
    PaymentIntentStatusEnum.SUCCEEDED,
    PaymentIntentStatusEnum.REQUIRES_CAPTURE,
    PaymentIntentStatusEnum.REQUIRES_PAYMENT_METHOD,
    PaymentIntentStatusEnum.CANCELED,
  ],
  [PaymentIntentStatusEnum.PROCESSING]: [
    PaymentIntentStatusEnum.SUCCEEDED,
    PaymentIntentStatusEnum.REQUIRES_CAPTURE,
    PaymentIntentStatusEnum.REQUIRES_ACTION,
    PaymentIntentStatusEnum.REQUIRES_PAYMENT_METHOD,
    PaymentIntentStatusEnum.CANCELED,
  ],
  [PaymentIntentStatusEnum.REQUIRES_CAPTURE]: [
    PaymentIntentStatusEnum.PROCESSING,
    PaymentIntentStatusEnum.SUCCEEDED,
    PaymentIntentStatusEnum.CANCELED,
  ],
  [PaymentIntentStatusEnum.SUCCEEDED]: [],
  [PaymentIntentStatusEnum.CANCELED]: [],
};

export const DECLINE_TAXONOMY: Record<
  DeclineCode,
  { kind: DeclineKind; retryDelayDays: readonly number[] }
> = {
  [DeclineCodeEnum.INSUFFICIENT_FUNDS]: {
    kind: DeclineKindEnum.SOFT,
    retryDelayDays: [3, 5, 7],
  },
  [DeclineCodeEnum.GENERIC_DECLINE]: { kind: DeclineKindEnum.SOFT, retryDelayDays: [1, 3, 5, 7] },
  [DeclineCodeEnum.DO_NOT_HONOR]: { kind: DeclineKindEnum.SOFT, retryDelayDays: [2, 5] },
  [DeclineCodeEnum.TRY_AGAIN_LATER]: { kind: DeclineKindEnum.SOFT, retryDelayDays: [1, 1, 3] },
  [DeclineCodeEnum.PROCESSING_ERROR]: { kind: DeclineKindEnum.SOFT, retryDelayDays: [1, 1, 3] },
  [DeclineCodeEnum.EXPIRED_CARD]: { kind: DeclineKindEnum.SOFT, retryDelayDays: [7] },
  [DeclineCodeEnum.INCORRECT_CVC]: { kind: DeclineKindEnum.SOFT, retryDelayDays: [7] },
  [DeclineCodeEnum.AUTHENTICATION_REQUIRED]: {
    kind: DeclineKindEnum.SOFT,
    retryDelayDays: [1, 3],
  },
  [DeclineCodeEnum.LOST_CARD]: { kind: DeclineKindEnum.HARD, retryDelayDays: [] },
  [DeclineCodeEnum.STOLEN_CARD]: { kind: DeclineKindEnum.HARD, retryDelayDays: [] },
  [DeclineCodeEnum.FRAUDULENT]: { kind: DeclineKindEnum.HARD, retryDelayDays: [] },
  [DeclineCodeEnum.PICKUP_CARD]: { kind: DeclineKindEnum.HARD, retryDelayDays: [] },
  [DeclineCodeEnum.INVALID_ACCOUNT]: { kind: DeclineKindEnum.HARD, retryDelayDays: [] },
  [DeclineCodeEnum.CURRENCY_NOT_SUPPORTED]: { kind: DeclineKindEnum.HARD, retryDelayDays: [] },
};

export const chargeSchema = Type.Object({
  id: Type.String(),
  paymentIntentId: Type.String(),
  customerId: Type.String(),
  paymentMethodId: Type.Union([Type.String(), Type.Null()]),
  currency: Type.Unsafe<Currency>(Type.Enum(CurrencyEnum)),
  amount: Type.Integer(),
  amountCaptured: Type.Integer(),
  amountRefunded: Type.Integer(),
  captured: Type.Boolean(),
  status: Type.Unsafe<ChargeStatus>(Type.Enum(ChargeStatusEnum)),
  outcome: Type.Unsafe<ChargeOutcome>(Type.Enum(ChargeOutcomeEnum)),
  balanceTransactionId: Type.Union([Type.String(), Type.Null()]),
  paymentMethodDetails: Type.Record(Type.String(), Type.Unknown()),
  failureCode: Type.Union([Type.Unsafe<FailureCode>(Type.Enum(FailureCodeEnum)), Type.Null()]),
  declineCode: Type.Union([Type.Unsafe<DeclineCode>(Type.Enum(DeclineCodeEnum)), Type.Null()]),
  failureMessage: Type.Union([Type.String(), Type.Null()]),
  pspReference: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

export const paymentIntentSchema = Type.Object({
  id: Type.String(),
  invoiceId: Type.Union([Type.String(), Type.Null()]),
  customerId: Type.String(),
  customer: Type.Optional(Type.Unknown()),
  status: Type.Unsafe<PaymentIntentStatus>(Type.Enum(PaymentIntentStatusEnum)),
  currency: Type.Unsafe<Currency>(Type.Enum(CurrencyEnum)),
  amount: Type.Integer(),
  amountCapturable: Type.Integer(),
  amountReceived: Type.Integer(),
  captureMethod: Type.Unsafe<CaptureMethod>(Type.Enum(CaptureMethodEnum)),
  paymentMethodId: Type.Union([Type.String(), Type.Null()]),
  latestChargeId: Type.Union([Type.String(), Type.Null()]),
  nextAction: Type.Union([
    Type.Object({
      type: Type.Unsafe<NextActionType>(Type.Enum(NextActionTypeEnum)),
      redirectUrl: Type.String(),
    }),
    Type.Null(),
  ]),
  cancellationReason: Type.Union([
    Type.Unsafe<PaymentCancellationReason>(Type.Enum(PaymentCancellationReasonEnum)),
    Type.Null(),
  ]),
  pspReference: Type.Union([Type.String(), Type.Null()]),
  failureCode: Type.Union([Type.Unsafe<FailureCode>(Type.Enum(FailureCodeEnum)), Type.Null()]),
  declineCode: Type.Union([Type.Unsafe<DeclineCode>(Type.Enum(DeclineCodeEnum)), Type.Null()]),
  failureMessage: Type.Union([Type.String(), Type.Null()]),
  charges: Type.Array(chargeSchema),
  metadata: Type.Record(Type.String(), Type.String()),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

export const refundSchema = Type.Object({
  id: Type.String(),
  chargeId: Type.String(),
  paymentIntentId: Type.String(),
  invoiceId: Type.Union([Type.String(), Type.Null()]),
  creditNoteId: Type.Union([Type.String(), Type.Null()]),
  customerId: Type.String(),
  customer: Type.Optional(Type.Unknown()),
  currency: Type.Unsafe<Currency>(Type.Enum(CurrencyEnum)),
  amount: Type.Integer(),
  status: Type.Unsafe<RefundStatus>(Type.Enum(RefundStatusEnum)),
  reason: Type.String(),
  failureReason: Type.Union([Type.String(), Type.Null()]),
  pspReference: Type.String(),
  metadata: Type.Record(Type.String(), Type.String()),
  createdAt: Type.String(),
});

export const paymentIntentParamsSchema = Type.Object({
  paymentIntentId: Type.String(),
});

export const createPaymentIntentSchema = Type.Object(
  {
    invoiceId: Type.Optional(Type.String({ minLength: 1 })),
    customerId: Type.Optional(Type.String({ minLength: 1 })),
    currency: Type.Optional(Type.Unsafe<Currency>(Type.Enum(CurrencyEnum))),
    amount: Type.Optional(Type.Integer({ minimum: 1 })),
    paymentMethodId: Type.Optional(Type.String({ minLength: 1 })),
    captureMethod: Type.Optional(Type.Unsafe<CaptureMethod>(Type.Enum(CaptureMethodEnum))),
    metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
  },
  { additionalProperties: false },
);

export const confirmPaymentIntentSchema = Type.Object(
  {
    paymentMethodId: Type.Optional(Type.String({ minLength: 1 })),
    metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
  },
  { additionalProperties: false },
);

export const capturePaymentIntentSchema = Type.Object(
  {
    amount: Type.Optional(Type.Integer({ minimum: 1 })),
    metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
  },
  { additionalProperties: false },
);

export const cancelPaymentIntentSchema = Type.Object(
  {
    cancellationReason: Type.Optional(
      Type.Unsafe<PaymentCancellationReason>(Type.Enum(PaymentCancellationReasonEnum)),
    ),
    metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
  },
  { additionalProperties: false },
);

export const createRefundSchema = Type.Object(
  {
    chargeId: Type.String({ minLength: 1 }),
    amount: Type.Optional(Type.Integer({ minimum: 1 })),
    reason: Type.String({ minLength: 1 }),
    metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
  },
  { additionalProperties: false },
);

export const findPaymentIntentsSchema = Type.Object(
  {
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
    after: Type.Optional(Type.String()),
    before: Type.Optional(Type.String()),
    invoiceId: Type.Optional(Type.String()),
    customerId: Type.Optional(Type.String()),
    status: Type.Optional(Type.Unsafe<PaymentIntentStatus>(Type.Enum(PaymentIntentStatusEnum))),
    expand: Type.Optional(Type.Array(Type.String())),
  },
  { additionalProperties: false },
);

export const findRefundsSchema = Type.Object(
  {
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
    after: Type.Optional(Type.String()),
    before: Type.Optional(Type.String()),
    invoiceId: Type.Optional(Type.String()),
    chargeId: Type.Optional(Type.String()),
    paymentIntentId: Type.Optional(Type.String()),
    status: Type.Optional(Type.Unsafe<RefundStatus>(Type.Enum(RefundStatusEnum))),
    expand: Type.Optional(Type.Array(Type.String())),
  },
  { additionalProperties: false },
);

export const pspCallbackSchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    type: Type.Unsafe<PspEventType>(Type.Enum(PspEventTypeEnum)),
    reference: Type.String({ minLength: 1 }),
    amount: Type.Optional(Type.Integer({ minimum: 0 })),
    failureCode: Type.Optional(Type.Unsafe<FailureCode>(Type.Enum(FailureCodeEnum))),
    declineCode: Type.Optional(Type.String()),
    failureMessage: Type.Optional(Type.String()),
    sourceReference: Type.Optional(Type.String()),
    reason: Type.Optional(Type.String()),
    outcome: Type.Optional(Type.String()),
    paymentMethodDetails: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  },
  { additionalProperties: false },
);

export const pspCallbackParamsSchema = Type.Object({
  provider: Type.Unsafe<PspProvider>(Type.Enum(PspProviderEnum)),
});

export const pspCallbackResponseSchema = Type.Object({
  provider: Type.Unsafe<PspProvider>(Type.Enum(PspProviderEnum)),
  eventId: Type.String(),
  isDuplicate: Type.Boolean(),
});

export type ChargeResponse = Static<typeof chargeSchema>;
export type NextAction = NonNullable<Static<typeof paymentIntentSchema>['nextAction']>;
export type PaymentMethodDetails = ChargeResponse['paymentMethodDetails'];
export type PaymentIntentResponse = Static<typeof paymentIntentSchema>;
export type RefundResponse = Static<typeof refundSchema>;
export type CreatePaymentIntentPayload = Static<typeof createPaymentIntentSchema>;
export type ConfirmPaymentIntentPayload = Static<typeof confirmPaymentIntentSchema>;
export type CapturePaymentIntentPayload = Static<typeof capturePaymentIntentSchema>;
export type CancelPaymentIntentPayload = Static<typeof cancelPaymentIntentSchema>;
export type CreateRefundPayload = Static<typeof createRefundSchema>;
export type FindPaymentIntentsQuery = Static<typeof findPaymentIntentsSchema>;
export type FindRefundsQuery = Static<typeof findRefundsSchema>;
export type PspCallbackPayload = Static<typeof pspCallbackSchema>;
export type PspCallbackResponse = Static<typeof pspCallbackResponseSchema>;
