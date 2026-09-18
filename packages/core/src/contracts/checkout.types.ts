import type { Static } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';
import type { Currency } from '@utils/currency';
import { CurrencyEnum } from '@utils/currency';

export enum CheckoutSessionModeEnum {
  PAYMENT = 'payment',
  SUBSCRIPTION = 'subscription',
  SETUP = 'setup',
}
export type CheckoutSessionMode = `${CheckoutSessionModeEnum}`;

export enum CheckoutSessionStatusEnum {
  OPEN = 'open',
  COMPLETE = 'complete',
  EXPIRED = 'expired',
}
export type CheckoutSessionStatus = `${CheckoutSessionStatusEnum}`;

export enum CheckoutPaymentStatusEnum {
  UNPAID = 'unpaid',
  PAID = 'paid',
  NO_PAYMENT_REQUIRED = 'no_payment_required',
}
export type CheckoutPaymentStatus = `${CheckoutPaymentStatusEnum}`;

export const CHECKOUT_SESSION_TRANSITIONS: Record<CheckoutSessionStatus, CheckoutSessionStatus[]> =
  {
    [CheckoutSessionStatusEnum.OPEN]: [
      CheckoutSessionStatusEnum.COMPLETE,
      CheckoutSessionStatusEnum.EXPIRED,
    ],
    [CheckoutSessionStatusEnum.COMPLETE]: [],
    [CheckoutSessionStatusEnum.EXPIRED]: [],
  };

export const checkoutSessionSchema = Type.Object({
  object: Type.Literal('checkout.session'),
  id: Type.String(),
  livemode: Type.Boolean(),
  mode: Type.Unsafe<CheckoutSessionMode>(Type.Enum(CheckoutSessionModeEnum)),
  status: Type.Unsafe<CheckoutSessionStatus>(Type.Enum(CheckoutSessionStatusEnum)),
  paymentStatus: Type.Unsafe<CheckoutPaymentStatus>(Type.Enum(CheckoutPaymentStatusEnum)),
  customerId: Type.String(),
  currency: Type.Unsafe<Currency>(Type.Enum(CurrencyEnum)),
  amountSubtotal: Type.Integer(),
  amountTotal: Type.Integer(),
  successUrl: Type.String(),
  cancelUrl: Type.Union([Type.String(), Type.Null()]),
  url: Type.Union([Type.String(), Type.Null()]),
  clientReferenceId: Type.Union([Type.String(), Type.Null()]),
  paymentLinkId: Type.Union([Type.String(), Type.Null()]),
  subscriptionId: Type.Union([Type.String(), Type.Null()]),
  invoiceId: Type.Union([Type.String(), Type.Null()]),
  paymentIntentId: Type.Union([Type.String(), Type.Null()]),
  setupIntentId: Type.Union([Type.String(), Type.Null()]),
  lineItems: Type.Array(
    Type.Object({
      object: Type.Literal('checkout.session.line_item'),
      id: Type.String(),
      priceId: Type.String(),
      quantity: Type.Integer(),
      amountSubtotal: Type.Integer(),
      amountTotal: Type.Integer(),
    }),
  ),
  expiresAt: Type.String(),
  completedAt: Type.Union([Type.String(), Type.Null()]),
  metadata: Type.Record(Type.String(), Type.String()),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

export const checkoutSessionParamsSchema = Type.Object({
  checkoutSessionId: Type.String(),
});

export const createCheckoutSessionSchema = Type.Object(
  {
    mode: Type.Unsafe<CheckoutSessionMode>(Type.Enum(CheckoutSessionModeEnum)),
    customerId: Type.String({ minLength: 1 }),
    successUrl: Type.String({ minLength: 1 }),
    cancelUrl: Type.Optional(Type.String({ minLength: 1 })),
    clientReferenceId: Type.Optional(Type.String({ minLength: 1 })),
    expiresAt: Type.Optional(Type.String({ format: 'date-time' })),
    lineItems: Type.Optional(
      Type.Array(
        Type.Object(
          {
            priceId: Type.String({ minLength: 1 }),
            quantity: Type.Optional(Type.Integer({ minimum: 1 })),
          },
          { additionalProperties: false },
        ),
        { maxItems: 20 },
      ),
    ),
    metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
  },
  { additionalProperties: false },
);

export const completeCheckoutSessionSchema = Type.Object(
  {
    token: Type.Optional(Type.String({ minLength: 1 })),
    paymentMethodId: Type.Optional(Type.String({ minLength: 1 })),
  },
  { additionalProperties: false },
);

export const findCheckoutSessionsSchema = Type.Object(
  {
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
    startingAfter: Type.Optional(Type.String()),
    endingBefore: Type.Optional(Type.String()),
    customerId: Type.Optional(Type.String({ minLength: 1 })),
    status: Type.Optional(Type.Unsafe<CheckoutSessionStatus>(Type.Enum(CheckoutSessionStatusEnum))),
  },
  { additionalProperties: false },
);

export type CheckoutSessionResponse = Static<typeof checkoutSessionSchema>;
export type CreateCheckoutSessionPayload = Static<typeof createCheckoutSessionSchema>;
export type CompleteCheckoutSessionPayload = Static<typeof completeCheckoutSessionSchema>;
export type FindCheckoutSessionsQuery = Static<typeof findCheckoutSessionsSchema>;
