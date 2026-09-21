import type { Static } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';

export enum PaymentMethodTypeEnum {
  CARD = 'card',
  BANK_ACCOUNT = 'bank_account',
  WALLET = 'wallet',
}
export type PaymentMethodType = `${PaymentMethodTypeEnum}`;

export enum CardFundingEnum {
  CREDIT = 'credit',
  DEBIT = 'debit',
  PREPAID = 'prepaid',
  UNKNOWN = 'unknown',
}
export type CardFunding = `${CardFundingEnum}`;

export const paymentMethodSchema = Type.Object({
  id: Type.String(),
  customerId: Type.Union([Type.String(), Type.Null()]),
  customer: Type.Optional(Type.Unknown()),
  type: Type.Unsafe<PaymentMethodType>(Type.Enum(PaymentMethodTypeEnum)),
  card: Type.Union([
    Type.Object({
      brand: Type.String(),
      last4: Type.String(),
      expMonth: Type.Integer(),
      expYear: Type.Integer(),
      fingerprint: Type.String(),
      funding: Type.Unsafe<CardFunding>(Type.Enum(CardFundingEnum)),
      country: Type.String(),
    }),
    Type.Null(),
  ]),
  billingDetails: Type.Object({
    name: Type.Optional(Type.String()),
    email: Type.Optional(Type.String()),
    phone: Type.Optional(Type.String()),
    line1: Type.Optional(Type.String()),
    line2: Type.Optional(Type.String()),
    city: Type.Optional(Type.String()),
    state: Type.Optional(Type.String()),
    postalCode: Type.Optional(Type.String()),
    country: Type.Optional(Type.String()),
  }),
  metadata: Type.Record(Type.String(), Type.String()),
  createdAt: Type.String(),
  updatedAt: Type.String(),
  detachedAt: Type.Union([Type.String(), Type.Null()]),
});

export const paymentMethodParamsSchema = Type.Object({
  paymentMethodId: Type.String(),
});

export const createPaymentMethodSchema = Type.Object(
  {
    type: Type.Unsafe<PaymentMethodType>(Type.Enum(PaymentMethodTypeEnum)),
    token: Type.String({ minLength: 1 }),
    customerId: Type.Optional(Type.String({ minLength: 1 })),
    billingDetails: Type.Optional(
      Type.Object(
        {
          name: Type.Optional(Type.String()),
          email: Type.Optional(Type.String()),
          phone: Type.Optional(Type.String()),
          line1: Type.Optional(Type.String()),
          line2: Type.Optional(Type.String()),
          city: Type.Optional(Type.String()),
          state: Type.Optional(Type.String()),
          postalCode: Type.Optional(Type.String()),
          country: Type.Optional(Type.String()),
        },
        { additionalProperties: false },
      ),
    ),
    metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
  },
  { additionalProperties: false },
);

export const attachPaymentMethodSchema = Type.Object(
  {
    customerId: Type.String({ minLength: 1 }),
    shouldBeDefault: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

export const updatePaymentMethodSchema = Type.Object(
  {
    billingDetails: Type.Optional(
      Type.Object(
        {
          name: Type.Optional(Type.String()),
          email: Type.Optional(Type.String()),
          phone: Type.Optional(Type.String()),
          line1: Type.Optional(Type.String()),
          line2: Type.Optional(Type.String()),
          city: Type.Optional(Type.String()),
          state: Type.Optional(Type.String()),
          postalCode: Type.Optional(Type.String()),
          country: Type.Optional(Type.String()),
        },
        { additionalProperties: false },
      ),
    ),
    card: Type.Optional(
      Type.Object(
        { expMonth: Type.Integer({ minimum: 1, maximum: 12 }), expYear: Type.Integer() },
        { additionalProperties: false },
      ),
    ),
    metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
  },
  { additionalProperties: false },
);

export const findPaymentMethodsSchema = Type.Object(
  {
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
    after: Type.Optional(Type.String()),
    before: Type.Optional(Type.String()),
    customerId: Type.Optional(Type.String()),
    type: Type.Optional(Type.Unsafe<PaymentMethodType>(Type.Enum(PaymentMethodTypeEnum))),
    expand: Type.Optional(Type.Array(Type.String())),
  },
  { additionalProperties: false },
);

export type PaymentMethodResponse = Static<typeof paymentMethodSchema>;
export type PaymentMethodCard = NonNullable<PaymentMethodResponse['card']>;
export type BillingDetails = PaymentMethodResponse['billingDetails'];
export type CreatePaymentMethodPayload = Static<typeof createPaymentMethodSchema>;
export type AttachPaymentMethodPayload = Static<typeof attachPaymentMethodSchema>;
export type UpdatePaymentMethodPayload = Static<typeof updatePaymentMethodSchema>;
export type FindPaymentMethodsQuery = Static<typeof findPaymentMethodsSchema>;
