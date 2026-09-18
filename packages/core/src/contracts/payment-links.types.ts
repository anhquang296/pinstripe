import type { CheckoutSessionMode } from '@contracts/checkout.types';
import { CheckoutSessionModeEnum } from '@contracts/checkout.types';
import type { Static } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';
import type { Currency } from '@utils/currency';
import { CurrencyEnum } from '@utils/currency';

export const paymentLinkSchema = Type.Object({
  id: Type.String(),
  isActive: Type.Boolean(),
  mode: Type.Unsafe<CheckoutSessionMode>(Type.Enum(CheckoutSessionModeEnum)),
  currency: Type.Unsafe<Currency>(Type.Enum(CurrencyEnum)),
  url: Type.String(),
  successUrl: Type.String(),
  lineItems: Type.Array(
    Type.Object({
      id: Type.String(),
      priceId: Type.String(),
      quantity: Type.Integer(),
    }),
  ),
  metadata: Type.Record(Type.String(), Type.String()),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

export const paymentLinkParamsSchema = Type.Object({
  paymentLinkId: Type.String(),
});

export const createPaymentLinkSchema = Type.Object(
  {
    mode: Type.Optional(Type.Unsafe<CheckoutSessionMode>(Type.Enum(CheckoutSessionModeEnum))),
    successUrl: Type.String({ minLength: 1 }),
    lineItems: Type.Array(
      Type.Object(
        {
          priceId: Type.String({ minLength: 1 }),
          quantity: Type.Optional(Type.Integer({ minimum: 1 })),
        },
        { additionalProperties: false },
      ),
      { minItems: 1, maxItems: 20 },
    ),
    metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
  },
  { additionalProperties: false },
);

export const updatePaymentLinkSchema = Type.Object(
  {
    isActive: Type.Optional(Type.Boolean()),
    successUrl: Type.Optional(Type.String({ minLength: 1 })),
    metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
  },
  { additionalProperties: false },
);

export const findPaymentLinksSchema = Type.Object(
  {
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
    startingAfter: Type.Optional(Type.String()),
    endingBefore: Type.Optional(Type.String()),
    isActive: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

export type PaymentLinkResponse = Static<typeof paymentLinkSchema>;
export type CreatePaymentLinkPayload = Static<typeof createPaymentLinkSchema>;
export type UpdatePaymentLinkPayload = Static<typeof updatePaymentLinkSchema>;
export type FindPaymentLinksQuery = Static<typeof findPaymentLinksSchema>;
