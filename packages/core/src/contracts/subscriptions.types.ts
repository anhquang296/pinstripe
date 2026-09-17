import type { Static } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';
import type { Currency } from '@utils/currency';
import { CurrencyEnum } from '@utils/currency';

export enum SubscriptionStatusEnum {
  INCOMPLETE = 'incomplete',
  TRIALING = 'trialing',
  ACTIVE = 'active',
  PAST_DUE = 'past_due',
  UNPAID = 'unpaid',
  CANCELED = 'canceled',
}
export type SubscriptionStatus = `${SubscriptionStatusEnum}`;

export enum CollectionMethodEnum {
  CHARGE_AUTOMATICALLY = 'charge_automatically',
  SEND_INVOICE = 'send_invoice',
}
export type CollectionMethod = `${CollectionMethodEnum}`;

export enum ProrationBehaviorEnum {
  CREATE_PRORATIONS = 'create_prorations',
  NONE = 'none',
  ALWAYS_INVOICE = 'always_invoice',
}
export type ProrationBehavior = `${ProrationBehaviorEnum}`;

export const SUBSCRIPTION_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  [SubscriptionStatusEnum.INCOMPLETE]: [
    SubscriptionStatusEnum.TRIALING,
    SubscriptionStatusEnum.ACTIVE,
    SubscriptionStatusEnum.CANCELED,
  ],
  [SubscriptionStatusEnum.TRIALING]: [
    SubscriptionStatusEnum.ACTIVE,
    SubscriptionStatusEnum.PAST_DUE,
    SubscriptionStatusEnum.CANCELED,
  ],
  [SubscriptionStatusEnum.ACTIVE]: [
    SubscriptionStatusEnum.PAST_DUE,
    SubscriptionStatusEnum.CANCELED,
  ],
  [SubscriptionStatusEnum.PAST_DUE]: [
    SubscriptionStatusEnum.ACTIVE,
    SubscriptionStatusEnum.UNPAID,
    SubscriptionStatusEnum.CANCELED,
  ],
  [SubscriptionStatusEnum.UNPAID]: [SubscriptionStatusEnum.ACTIVE, SubscriptionStatusEnum.CANCELED],
  [SubscriptionStatusEnum.CANCELED]: [],
};

export const subscriptionItemSchema = Type.Object({
  object: Type.Literal('subscription_item'),
  id: Type.String(),
  subscriptionId: Type.String(),
  priceId: Type.String(),
  quantity: Type.Integer(),
  metadata: Type.Record(Type.String(), Type.String()),
  createdAt: Type.String(),
});

export const subscriptionSchema = Type.Object({
  object: Type.Literal('subscription'),
  id: Type.String(),
  customerId: Type.String(),
  customer: Type.Optional(Type.Unknown()),
  status: Type.Unsafe<SubscriptionStatus>(Type.Enum(SubscriptionStatusEnum)),
  currency: Type.Unsafe<Currency>(Type.Enum(CurrencyEnum)),
  collectionMethod: Type.Unsafe<CollectionMethod>(Type.Enum(CollectionMethodEnum)),
  items: Type.Array(subscriptionItemSchema),
  billingCycleAnchor: Type.String(),
  currentPeriodStart: Type.String(),
  currentPeriodEnd: Type.String(),
  chargedThroughDate: Type.Union([Type.String(), Type.Null()]),
  trialStart: Type.Union([Type.String(), Type.Null()]),
  trialEnd: Type.Union([Type.String(), Type.Null()]),
  cancelAtPeriodEnd: Type.Boolean(),
  canceledAt: Type.Union([Type.String(), Type.Null()]),
  endedAt: Type.Union([Type.String(), Type.Null()]),
  testClockId: Type.Union([Type.String(), Type.Null()]),
  metadata: Type.Record(Type.String(), Type.String()),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

export const subscriptionParamsSchema = Type.Object({
  subscriptionId: Type.String(),
});

export const createSubscriptionSchema = Type.Object(
  {
    customerId: Type.String({ minLength: 1 }),
    items: Type.Array(
      Type.Object({
        priceId: Type.String({ minLength: 1 }),
        quantity: Type.Optional(Type.Integer({ minimum: 1 })),
        metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
      }),
      { minItems: 1 },
    ),
    trialPeriodDays: Type.Optional(Type.Integer({ minimum: 1, maximum: 730 })),
    trialEnd: Type.Optional(Type.String({ format: 'date-time' })),
    billingCycleAnchor: Type.Optional(Type.String({ format: 'date-time' })),
    collectionMethod: Type.Optional(Type.Unsafe<CollectionMethod>(Type.Enum(CollectionMethodEnum))),
    metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
  },
  { additionalProperties: false },
);

export const updateSubscriptionSchema = Type.Object(
  {
    items: Type.Optional(
      Type.Array(
        Type.Object({
          priceId: Type.String({ minLength: 1 }),
          quantity: Type.Optional(Type.Integer({ minimum: 1 })),
          metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
        }),
        { minItems: 1 },
      ),
    ),
    prorationBehavior: Type.Optional(
      Type.Unsafe<ProrationBehavior>(Type.Enum(ProrationBehaviorEnum)),
    ),
    cancelAtPeriodEnd: Type.Optional(Type.Boolean()),
    metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
  },
  { additionalProperties: false },
);

export const cancelSubscriptionSchema = Type.Object(
  {
    cancelAtPeriodEnd: Type.Optional(Type.Boolean()),
    comment: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export const findSubscriptionsSchema = Type.Object(
  {
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
    startingAfter: Type.Optional(Type.String()),
    endingBefore: Type.Optional(Type.String()),
    customerId: Type.Optional(Type.String()),
    status: Type.Optional(Type.Unsafe<SubscriptionStatus>(Type.Enum(SubscriptionStatusEnum))),
  },
  { additionalProperties: false },
);

export type SubscriptionResponse = Static<typeof subscriptionSchema>;
export type SubscriptionItemResponse = Static<typeof subscriptionItemSchema>;
export type CreateSubscriptionPayload = Static<typeof createSubscriptionSchema>;
export type UpdateSubscriptionPayload = Static<typeof updateSubscriptionSchema>;
export type CancelSubscriptionPayload = Static<typeof cancelSubscriptionSchema>;
export type FindSubscriptionsQuery = Static<typeof findSubscriptionsSchema>;
