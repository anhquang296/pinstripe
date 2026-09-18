import type { Static } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';
import type { Currency } from '@utils/currency';
import { CurrencyEnum } from '@utils/currency';

export enum CouponDurationEnum {
  ONCE = 'once',
  REPEATING = 'repeating',
  FOREVER = 'forever',
}
export type CouponDuration = `${CouponDurationEnum}`;

export enum DiscountLevelEnum {
  CUSTOMER = 'customer',
  SUBSCRIPTION = 'subscription',
  SUBSCRIPTION_ITEM = 'subscription_item',
  INVOICE = 'invoice',
  INVOICE_ITEM = 'invoice_item',
}
export type DiscountLevel = `${DiscountLevelEnum}`;

export const couponSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  percentOff: Type.Union([Type.Number(), Type.Null()]),
  amountOff: Type.Union([Type.Integer(), Type.Null()]),
  currency: Type.Union([Type.Unsafe<Currency>(Type.Enum(CurrencyEnum)), Type.Null()]),
  duration: Type.Unsafe<CouponDuration>(Type.Enum(CouponDurationEnum)),
  durationInMonths: Type.Union([Type.Integer(), Type.Null()]),
  maxRedemptions: Type.Union([Type.Integer(), Type.Null()]),
  timesRedeemed: Type.Integer(),
  redeemBy: Type.Union([Type.String(), Type.Null()]),
  appliesToProductIds: Type.Array(Type.String()),
  valid: Type.Boolean(),
  metadata: Type.Record(Type.String(), Type.String()),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

export const deletedCouponSchema = Type.Object({
  id: Type.String(),
  deleted: Type.Literal(true),
});

export const promotionCodeSchema = Type.Object({
  id: Type.String(),
  code: Type.String(),
  couponId: Type.String(),
  coupon: Type.Optional(Type.Unknown()),
  customerId: Type.Union([Type.String(), Type.Null()]),
  active: Type.Boolean(),
  maxRedemptions: Type.Union([Type.Integer(), Type.Null()]),
  timesRedeemed: Type.Integer(),
  expiresAt: Type.Union([Type.String(), Type.Null()]),
  firstTimeTransaction: Type.Boolean(),
  minimumAmount: Type.Union([Type.Integer(), Type.Null()]),
  metadata: Type.Record(Type.String(), Type.String()),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

export const discountSchema = Type.Object({
  id: Type.String(),
  couponId: Type.String(),
  coupon: Type.Optional(Type.Unknown()),
  promotionCodeId: Type.Union([Type.String(), Type.Null()]),
  customerId: Type.String(),
  customer: Type.Optional(Type.Unknown()),
  level: Type.Unsafe<DiscountLevel>(Type.Enum(DiscountLevelEnum)),
  subscriptionId: Type.Union([Type.String(), Type.Null()]),
  subscriptionItemId: Type.Union([Type.String(), Type.Null()]),
  invoiceId: Type.Union([Type.String(), Type.Null()]),
  invoiceItemId: Type.Union([Type.String(), Type.Null()]),
  startAt: Type.String(),
  endAt: Type.Union([Type.String(), Type.Null()]),
  metadata: Type.Record(Type.String(), Type.String()),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

export const deletedDiscountSchema = Type.Object({
  id: Type.String(),
  deleted: Type.Literal(true),
});

export const couponParamsSchema = Type.Object({
  couponId: Type.String(),
});

export const promotionCodeParamsSchema = Type.Object({
  promotionCodeId: Type.String(),
});

export const discountParamsSchema = Type.Object({
  discountId: Type.String(),
});

export const createCouponSchema = Type.Object(
  {
    name: Type.Optional(Type.String({ minLength: 1 })),
    percentOff: Type.Optional(Type.Number({ exclusiveMinimum: 0, maximum: 100 })),
    amountOff: Type.Optional(Type.Integer({ minimum: 1 })),
    currency: Type.Optional(Type.Unsafe<Currency>(Type.Enum(CurrencyEnum))),
    duration: Type.Unsafe<CouponDuration>(Type.Enum(CouponDurationEnum)),
    durationInMonths: Type.Optional(Type.Integer({ minimum: 1, maximum: 120 })),
    maxRedemptions: Type.Optional(Type.Integer({ minimum: 1 })),
    redeemBy: Type.Optional(Type.String({ format: 'date-time' })),
    appliesToProductIds: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
    metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
  },
  { additionalProperties: false },
);

export const updateCouponSchema = Type.Object(
  {
    name: Type.Optional(Type.String({ minLength: 1 })),
    metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
  },
  { additionalProperties: false },
);

export const findCouponsSchema = Type.Object(
  {
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
    startingAfter: Type.Optional(Type.String()),
    endingBefore: Type.Optional(Type.String()),
    expand: Type.Optional(Type.Array(Type.String())),
  },
  { additionalProperties: false },
);

export const createPromotionCodeSchema = Type.Object(
  {
    couponId: Type.String({ minLength: 1 }),
    code: Type.Optional(Type.String({ minLength: 3, maxLength: 64 })),
    customerId: Type.Optional(Type.String({ minLength: 1 })),
    active: Type.Optional(Type.Boolean()),
    maxRedemptions: Type.Optional(Type.Integer({ minimum: 1 })),
    expiresAt: Type.Optional(Type.String({ format: 'date-time' })),
    firstTimeTransaction: Type.Optional(Type.Boolean()),
    minimumAmount: Type.Optional(Type.Integer({ minimum: 1 })),
    metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
  },
  { additionalProperties: false },
);

export const updatePromotionCodeSchema = Type.Object(
  {
    active: Type.Optional(Type.Boolean()),
    metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
  },
  { additionalProperties: false },
);

export const findPromotionCodesSchema = Type.Object(
  {
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
    startingAfter: Type.Optional(Type.String()),
    endingBefore: Type.Optional(Type.String()),
    couponId: Type.Optional(Type.String()),
    code: Type.Optional(Type.String()),
    active: Type.Optional(Type.Boolean()),
    expand: Type.Optional(Type.Array(Type.String())),
  },
  { additionalProperties: false },
);

export const createDiscountSchema = Type.Object(
  {
    couponId: Type.Optional(Type.String({ minLength: 1 })),
    promotionCode: Type.Optional(Type.String({ minLength: 1 })),
    customerId: Type.Optional(Type.String({ minLength: 1 })),
    subscriptionId: Type.Optional(Type.String({ minLength: 1 })),
    subscriptionItemId: Type.Optional(Type.String({ minLength: 1 })),
    invoiceId: Type.Optional(Type.String({ minLength: 1 })),
    invoiceItemId: Type.Optional(Type.String({ minLength: 1 })),
    metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
  },
  { additionalProperties: false },
);

export const updateDiscountSchema = Type.Object(
  { metadata: Type.Optional(Type.Record(Type.String(), Type.String())) },
  { additionalProperties: false },
);

export const findDiscountsSchema = Type.Object(
  {
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
    startingAfter: Type.Optional(Type.String()),
    endingBefore: Type.Optional(Type.String()),
    customerId: Type.Optional(Type.String()),
    subscriptionId: Type.Optional(Type.String()),
    invoiceId: Type.Optional(Type.String()),
    couponId: Type.Optional(Type.String()),
    level: Type.Optional(Type.Unsafe<DiscountLevel>(Type.Enum(DiscountLevelEnum))),
    expand: Type.Optional(Type.Array(Type.String())),
  },
  { additionalProperties: false },
);

export type CouponResponse = Static<typeof couponSchema>;
export type DeletedCouponResponse = Static<typeof deletedCouponSchema>;
export type PromotionCodeResponse = Static<typeof promotionCodeSchema>;
export type DiscountResponse = Static<typeof discountSchema>;
export type DeletedDiscountResponse = Static<typeof deletedDiscountSchema>;
export type CreateCouponPayload = Static<typeof createCouponSchema>;
export type UpdateCouponPayload = Static<typeof updateCouponSchema>;
export type FindCouponsQuery = Static<typeof findCouponsSchema>;
export type CreatePromotionCodePayload = Static<typeof createPromotionCodeSchema>;
export type UpdatePromotionCodePayload = Static<typeof updatePromotionCodeSchema>;
export type FindPromotionCodesQuery = Static<typeof findPromotionCodesSchema>;
export type CreateDiscountPayload = Static<typeof createDiscountSchema>;
export type UpdateDiscountPayload = Static<typeof updateDiscountSchema>;
export type FindDiscountsQuery = Static<typeof findDiscountsSchema>;
