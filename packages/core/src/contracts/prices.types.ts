import type { Static } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';
import type { Currency } from '@utils/currency';
import { CurrencyEnum } from '@utils/currency';

export enum PriceTypeEnum {
  ONE_TIME = 'one_time',
  RECURRING = 'recurring',
}
export type PriceType = `${PriceTypeEnum}`;

export enum BillingSchemeEnum {
  PER_UNIT = 'per_unit',
  TIERED = 'tiered',
}
export type BillingScheme = `${BillingSchemeEnum}`;

export enum RecurringIntervalEnum {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year',
}
export type RecurringInterval = `${RecurringIntervalEnum}`;

export enum UsageTypeEnum {
  LICENSED = 'licensed',
  METERED = 'metered',
}
export type UsageType = `${UsageTypeEnum}`;

export enum TiersModeEnum {
  GRADUATED = 'graduated',
  VOLUME = 'volume',
}
export type TiersMode = `${TiersModeEnum}`;

export enum TaxBehaviorEnum {
  INCLUSIVE = 'inclusive',
  EXCLUSIVE = 'exclusive',
  UNSPECIFIED = 'unspecified',
}
export type TaxBehavior = `${TaxBehaviorEnum}`;

export enum RoundingModeEnum {
  UP = 'up',
  DOWN = 'down',
}
export type RoundingMode = `${RoundingModeEnum}`;

export const priceSchema = Type.Object({
  object: Type.Literal('price'),
  id: Type.String(),
  productId: Type.String(),
  lookupKey: Type.Union([Type.String(), Type.Null()]),
  version: Type.Integer(),
  effectiveAt: Type.String(),
  active: Type.Boolean(),
  nickname: Type.String(),
  currency: Type.Unsafe<Currency>(Type.Enum(CurrencyEnum)),
  type: Type.Unsafe<PriceType>(Type.Enum(PriceTypeEnum)),
  billingScheme: Type.Unsafe<BillingScheme>(Type.Enum(BillingSchemeEnum)),
  unitAmount: Type.Union([Type.Integer(), Type.Null()]),
  taxBehavior: Type.Unsafe<TaxBehavior>(Type.Enum(TaxBehaviorEnum)),
  recurring: Type.Union([
    Type.Object({
      interval: Type.Unsafe<RecurringInterval>(Type.Enum(RecurringIntervalEnum)),
      intervalCount: Type.Integer(),
      usageType: Type.Unsafe<UsageType>(Type.Enum(UsageTypeEnum)),
    }),
    Type.Null(),
  ]),
  meterId: Type.Union([Type.String(), Type.Null()]),
  tiersMode: Type.Union([Type.Unsafe<TiersMode>(Type.Enum(TiersModeEnum)), Type.Null()]),
  tiers: Type.Union([
    Type.Array(
      Type.Object({
        upTo: Type.Union([Type.Integer(), Type.Null()]),
        unitAmount: Type.Optional(Type.Integer()),
        flatAmount: Type.Optional(Type.Integer()),
      }),
    ),
    Type.Null(),
  ]),
  transformQuantity: Type.Union([
    Type.Object({
      divideBy: Type.Integer(),
      round: Type.Unsafe<RoundingMode>(Type.Enum(RoundingModeEnum)),
    }),
    Type.Null(),
  ]),
  metadata: Type.Record(Type.String(), Type.String()),
  createdAt: Type.String(),
});

export const priceParamsSchema = Type.Object({
  priceId: Type.String(),
});

export const createPriceSchema = Type.Object(
  {
    productId: Type.String({ minLength: 1 }),
    currency: Type.Unsafe<Currency>(Type.Enum(CurrencyEnum)),
    lookupKey: Type.Optional(Type.String({ minLength: 1 })),
    nickname: Type.Optional(Type.String()),
    effectiveAt: Type.Optional(Type.String({ format: 'date-time' })),
    billingScheme: Type.Optional(Type.Unsafe<BillingScheme>(Type.Enum(BillingSchemeEnum))),
    unitAmount: Type.Optional(Type.Integer({ minimum: 0 })),
    taxBehavior: Type.Optional(Type.Unsafe<TaxBehavior>(Type.Enum(TaxBehaviorEnum))),
    recurring: Type.Optional(
      Type.Object({
        interval: Type.Unsafe<RecurringInterval>(Type.Enum(RecurringIntervalEnum)),
        intervalCount: Type.Optional(Type.Integer({ minimum: 1, maximum: 52 })),
        usageType: Type.Optional(Type.Unsafe<UsageType>(Type.Enum(UsageTypeEnum))),
      }),
    ),
    meterId: Type.Optional(Type.String({ minLength: 1 })),
    tiersMode: Type.Optional(Type.Unsafe<TiersMode>(Type.Enum(TiersModeEnum))),
    tiers: Type.Optional(
      Type.Array(
        Type.Object({
          upTo: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
          unitAmount: Type.Optional(Type.Integer({ minimum: 0 })),
          flatAmount: Type.Optional(Type.Integer({ minimum: 0 })),
        }),
        { minItems: 1 },
      ),
    ),
    transformQuantity: Type.Optional(
      Type.Object({
        divideBy: Type.Integer({ minimum: 1 }),
        round: Type.Unsafe<RoundingMode>(Type.Enum(RoundingModeEnum)),
      }),
    ),
    metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
  },
  { additionalProperties: false },
);

export const updatePriceSchema = Type.Object(
  {
    active: Type.Optional(Type.Boolean()),
    nickname: Type.Optional(Type.String()),
    metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
  },
  { additionalProperties: false },
);

export const getPricesSchema = Type.Object(
  {
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
    startingAfter: Type.Optional(Type.String()),
    endingBefore: Type.Optional(Type.String()),
    productId: Type.Optional(Type.String()),
    lookupKey: Type.Optional(Type.String()),
    active: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

export type PriceResponse = Static<typeof priceSchema>;
export type CreatePricePayload = Static<typeof createPriceSchema>;
export type UpdatePricePayload = Static<typeof updatePriceSchema>;
export type GetPricesQuery = Static<typeof getPricesSchema>;
