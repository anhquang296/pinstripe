import type { Static } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';
import type { Currency } from '@utils/currency';
import { CurrencyEnum } from '@utils/currency';

export enum PaymentIntentStatusEnum {
  REQUIRES_PAYMENT_METHOD = 'requires_payment_method',
  REQUIRES_CONFIRMATION = 'requires_confirmation',
  SUCCEEDED = 'succeeded',
  CANCELED = 'canceled',
}
export type PaymentIntentStatus = `${PaymentIntentStatusEnum}`;

export enum PaymentAttemptOutcomeEnum {
  SUCCEEDED = 'succeeded',
  DECLINED = 'declined',
  ERRORED = 'errored',
}
export type PaymentAttemptOutcome = `${PaymentAttemptOutcomeEnum}`;

export const PAYMENT_INTENT_TRANSITIONS: Record<PaymentIntentStatus, PaymentIntentStatus[]> = {
  [PaymentIntentStatusEnum.REQUIRES_PAYMENT_METHOD]: [
    PaymentIntentStatusEnum.REQUIRES_CONFIRMATION,
    PaymentIntentStatusEnum.SUCCEEDED,
    PaymentIntentStatusEnum.CANCELED,
  ],
  [PaymentIntentStatusEnum.REQUIRES_CONFIRMATION]: [
    PaymentIntentStatusEnum.SUCCEEDED,
    PaymentIntentStatusEnum.REQUIRES_PAYMENT_METHOD,
    PaymentIntentStatusEnum.CANCELED,
  ],
  [PaymentIntentStatusEnum.SUCCEEDED]: [],
  [PaymentIntentStatusEnum.CANCELED]: [],
};

export const paymentIntentSchema = Type.Object({
  object: Type.Literal('payment_intent'),
  id: Type.String(),
  invoiceId: Type.Union([Type.String(), Type.Null()]),
  customerId: Type.String(),
  customer: Type.Optional(Type.Unknown()),
  status: Type.Unsafe<PaymentIntentStatus>(Type.Enum(PaymentIntentStatusEnum)),
  currency: Type.Unsafe<Currency>(Type.Enum(CurrencyEnum)),
  amount: Type.Integer(),
  paymentMethod: Type.Union([Type.String(), Type.Null()]),
  pspReference: Type.Union([Type.String(), Type.Null()]),
  failureCode: Type.Union([Type.String(), Type.Null()]),
  failureMessage: Type.Union([Type.String(), Type.Null()]),
  attempts: Type.Array(
    Type.Object({
      object: Type.Literal('payment_attempt'),
      id: Type.String(),
      paymentMethod: Type.String(),
      outcome: Type.Unsafe<PaymentAttemptOutcome>(Type.Enum(PaymentAttemptOutcomeEnum)),
      pspReference: Type.Union([Type.String(), Type.Null()]),
      failureCode: Type.Union([Type.String(), Type.Null()]),
      createdAt: Type.String(),
    }),
  ),
  metadata: Type.Record(Type.String(), Type.String()),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

export const refundSchema = Type.Object({
  object: Type.Literal('refund'),
  id: Type.String(),
  paymentIntentId: Type.String(),
  invoiceId: Type.Union([Type.String(), Type.Null()]),
  customerId: Type.String(),
  customer: Type.Optional(Type.Unknown()),
  currency: Type.Unsafe<Currency>(Type.Enum(CurrencyEnum)),
  amount: Type.Integer(),
  reason: Type.String(),
  pspReference: Type.String(),
  metadata: Type.Record(Type.String(), Type.String()),
  createdAt: Type.String(),
});

export const paymentIntentParamsSchema = Type.Object({
  paymentIntentId: Type.String(),
});

export const createPaymentIntentSchema = Type.Object(
  {
    invoiceId: Type.String({ minLength: 1 }),
    amount: Type.Optional(Type.Integer({ minimum: 1 })),
    paymentMethod: Type.Optional(Type.String({ minLength: 1 })),
    metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
  },
  { additionalProperties: false },
);

export const confirmPaymentIntentSchema = Type.Object(
  {
    paymentMethod: Type.Optional(Type.String({ minLength: 1 })),
    metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
  },
  { additionalProperties: false },
);

export const cancelPaymentIntentSchema = Type.Object(
  { metadata: Type.Optional(Type.Record(Type.String(), Type.String())) },
  { additionalProperties: false },
);

export const createRefundSchema = Type.Object(
  {
    paymentIntentId: Type.String({ minLength: 1 }),
    amount: Type.Optional(Type.Integer({ minimum: 1 })),
    reason: Type.String({ minLength: 1 }),
    metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
  },
  { additionalProperties: false },
);

export const findPaymentIntentsSchema = Type.Object(
  {
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
    startingAfter: Type.Optional(Type.String()),
    endingBefore: Type.Optional(Type.String()),
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
    startingAfter: Type.Optional(Type.String()),
    endingBefore: Type.Optional(Type.String()),
    invoiceId: Type.Optional(Type.String()),
    paymentIntentId: Type.Optional(Type.String()),
    expand: Type.Optional(Type.Array(Type.String())),
  },
  { additionalProperties: false },
);

export type PaymentIntentResponse = Static<typeof paymentIntentSchema>;
export type RefundResponse = Static<typeof refundSchema>;
export type CreatePaymentIntentPayload = Static<typeof createPaymentIntentSchema>;
export type ConfirmPaymentIntentPayload = Static<typeof confirmPaymentIntentSchema>;
export type CancelPaymentIntentPayload = Static<typeof cancelPaymentIntentSchema>;
export type CreateRefundPayload = Static<typeof createRefundSchema>;
export type FindPaymentIntentsQuery = Static<typeof findPaymentIntentsSchema>;
export type FindRefundsQuery = Static<typeof findRefundsSchema>;
