import type { Static } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';
import type { Currency } from '@utils/currency';
import { CurrencyEnum } from '@utils/currency';

export enum PayoutStatusEnum {
  PENDING = 'pending',
  IN_TRANSIT = 'in_transit',
  PAID = 'paid',
  FAILED = 'failed',
}
export type PayoutStatus = `${PayoutStatusEnum}`;

export const PAYOUT_TRANSITIONS: Record<PayoutStatus, PayoutStatus[]> = {
  [PayoutStatusEnum.PENDING]: [PayoutStatusEnum.IN_TRANSIT, PayoutStatusEnum.FAILED],
  [PayoutStatusEnum.IN_TRANSIT]: [PayoutStatusEnum.PAID, PayoutStatusEnum.FAILED],
  [PayoutStatusEnum.PAID]: [],
  [PayoutStatusEnum.FAILED]: [],
};

export const payoutSchema = Type.Object({
  id: Type.String(),
  currency: Type.Unsafe<Currency>(Type.Enum(CurrencyEnum)),
  amount: Type.Integer(),
  status: Type.Unsafe<PayoutStatus>(Type.Enum(PayoutStatusEnum)),
  statementDescriptor: Type.Union([Type.String(), Type.Null()]),
  arrivalAt: Type.String(),
  paidAt: Type.Union([Type.String(), Type.Null()]),
  failureCode: Type.Union([Type.String(), Type.Null()]),
  failureMessage: Type.Union([Type.String(), Type.Null()]),
  pspReference: Type.Union([Type.String(), Type.Null()]),
  metadata: Type.Record(Type.String(), Type.String()),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

export const payoutParamsSchema = Type.Object({
  payoutId: Type.String(),
});

export const createPayoutSchema = Type.Object(
  {
    currency: Type.Unsafe<Currency>(Type.Enum(CurrencyEnum)),
    statementDescriptor: Type.Optional(Type.String({ minLength: 1 })),
    metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
  },
  { additionalProperties: false },
);

export const findPayoutsSchema = Type.Object(
  {
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
    after: Type.Optional(Type.String()),
    before: Type.Optional(Type.String()),
    status: Type.Optional(Type.Unsafe<PayoutStatus>(Type.Enum(PayoutStatusEnum))),
  },
  { additionalProperties: false },
);

export type PayoutResponse = Static<typeof payoutSchema>;
export type CreatePayoutPayload = Static<typeof createPayoutSchema>;
export type FindPayoutsQuery = Static<typeof findPayoutsSchema>;
