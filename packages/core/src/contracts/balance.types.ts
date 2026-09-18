import type { Static } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';
import type { Currency } from '@utils/currency';
import { CurrencyEnum } from '@utils/currency';

export enum BalanceTransactionTypeEnum {
  CHARGE = 'charge',
  REFUND = 'refund',
  DISPUTE = 'dispute',
  DISPUTE_REVERSAL = 'dispute_reversal',
  ADJUSTMENT = 'adjustment',
}
export type BalanceTransactionType = `${BalanceTransactionTypeEnum}`;

export enum BalanceSourceTypeEnum {
  CHARGE = 'charge',
  REFUND = 'refund',
  DISPUTE = 'dispute',
}
export type BalanceSourceType = `${BalanceSourceTypeEnum}`;

export const balanceTransactionSchema = Type.Object({
  object: Type.Literal('balance_transaction'),
  id: Type.String(),
  type: Type.Unsafe<BalanceTransactionType>(Type.Enum(BalanceTransactionTypeEnum)),
  currency: Type.Unsafe<Currency>(Type.Enum(CurrencyEnum)),
  gross: Type.Integer(),
  fee: Type.Integer(),
  net: Type.Integer(),
  availableOn: Type.String(),
  sourceType: Type.Unsafe<BalanceSourceType>(Type.Enum(BalanceSourceTypeEnum)),
  sourceId: Type.String(),
  payoutId: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
});

export const balanceSchema = Type.Object({
  object: Type.Literal('balance'),
  asOf: Type.String(),
  available: Type.Array(
    Type.Object({
      currency: Type.Unsafe<Currency>(Type.Enum(CurrencyEnum)),
      amount: Type.Integer(),
    }),
  ),
  pending: Type.Array(
    Type.Object({
      currency: Type.Unsafe<Currency>(Type.Enum(CurrencyEnum)),
      amount: Type.Integer(),
    }),
  ),
  reserved: Type.Array(
    Type.Object({
      currency: Type.Unsafe<Currency>(Type.Enum(CurrencyEnum)),
      amount: Type.Integer(),
    }),
  ),
});

export const balanceTransactionParamsSchema = Type.Object({
  balanceTransactionId: Type.String(),
});

export const findBalanceTransactionsSchema = Type.Object(
  {
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
    startingAfter: Type.Optional(Type.String()),
    endingBefore: Type.Optional(Type.String()),
    type: Type.Optional(Type.Unsafe<BalanceTransactionType>(Type.Enum(BalanceTransactionTypeEnum))),
    payoutId: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export type BalanceTransactionResponse = Static<typeof balanceTransactionSchema>;
export type BalanceResponse = Static<typeof balanceSchema>;
export type BalanceAmount = BalanceResponse['available'][number];
export type FindBalanceTransactionsQuery = Static<typeof findBalanceTransactionsSchema>;
