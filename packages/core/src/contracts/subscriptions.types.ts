import { customerSchema } from '@contracts/customers.types';
import type { Static } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';
import type { Currency } from '@utils/currency';
import { CurrencyEnum } from '@utils/currency';

export enum SubscriptionStatusEnum {
  INCOMPLETE = 'incomplete',
  INCOMPLETE_EXPIRED = 'incomplete_expired',
  TRIALING = 'trialing',
  ACTIVE = 'active',
  PAST_DUE = 'past_due',
  UNPAID = 'unpaid',
  PAUSED = 'paused',
  CANCELED = 'canceled',
}
export type SubscriptionStatus = `${SubscriptionStatusEnum}`;

export enum PauseCollectionBehaviorEnum {
  KEEP_AS_DRAFT = 'keep_as_draft',
  MARK_UNCOLLECTIBLE = 'mark_uncollectible',
  VOID = 'void',
}
export type PauseCollectionBehavior = `${PauseCollectionBehaviorEnum}`;

export enum CancellationReasonEnum {
  CANCELLATION_REQUESTED = 'cancellation_requested',
  PAYMENT_DISPUTED = 'payment_disputed',
  PAYMENT_FAILED = 'payment_failed',
}
export type CancellationReason = `${CancellationReasonEnum}`;

export enum TrialEndBehaviorEnum {
  CANCEL = 'cancel',
  CREATE_INVOICE = 'create_invoice',
  PAUSE = 'pause',
}
export type TrialEndBehavior = `${TrialEndBehaviorEnum}`;

export enum CollectionMethodEnum {
  CHARGE_AUTOMATICALLY = 'charge_automatically',
  SEND_INVOICE = 'send_invoice',
  OFFSET_TICKET = 'offset_ticket',
  DEBIT_WALLET = 'debit_wallet',
}
export type CollectionMethod = `${CollectionMethodEnum}`;

export enum BillingModeEnum {
  ADVANCE = 'advance',
  ARREARS = 'arrears',
}
export type BillingMode = `${BillingModeEnum}`;

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
    SubscriptionStatusEnum.INCOMPLETE_EXPIRED,
    SubscriptionStatusEnum.CANCELED,
  ],
  [SubscriptionStatusEnum.INCOMPLETE_EXPIRED]: [],
  [SubscriptionStatusEnum.TRIALING]: [
    SubscriptionStatusEnum.ACTIVE,
    SubscriptionStatusEnum.INCOMPLETE,
    SubscriptionStatusEnum.PAST_DUE,
    SubscriptionStatusEnum.PAUSED,
    SubscriptionStatusEnum.CANCELED,
  ],
  [SubscriptionStatusEnum.ACTIVE]: [
    SubscriptionStatusEnum.INCOMPLETE,
    SubscriptionStatusEnum.PAST_DUE,
    SubscriptionStatusEnum.PAUSED,
    SubscriptionStatusEnum.CANCELED,
  ],
  [SubscriptionStatusEnum.PAST_DUE]: [
    SubscriptionStatusEnum.ACTIVE,
    SubscriptionStatusEnum.UNPAID,
    SubscriptionStatusEnum.PAUSED,
    SubscriptionStatusEnum.CANCELED,
  ],
  [SubscriptionStatusEnum.UNPAID]: [
    SubscriptionStatusEnum.ACTIVE,
    SubscriptionStatusEnum.PAUSED,
    SubscriptionStatusEnum.CANCELED,
  ],
  [SubscriptionStatusEnum.PAUSED]: [SubscriptionStatusEnum.ACTIVE, SubscriptionStatusEnum.CANCELED],
  [SubscriptionStatusEnum.CANCELED]: [],
};

export const BILLABLE_SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatusEnum.ACTIVE,
  SubscriptionStatusEnum.PAST_DUE,
  SubscriptionStatusEnum.PAUSED,
];

export const subscriptionItemSchema = Type.Object({
  id: Type.String(),
  subscriptionId: Type.String(),
  priceId: Type.String(),
  quantity: Type.Integer(),
  taxRates: Type.Array(Type.String()),
  metadata: Type.Record(Type.String(), Type.String()),
  createdAt: Type.String(),
});

export const subscriptionSchema = Type.Object({
  id: Type.String(),
  customerId: Type.String(),
  customer: Type.Optional(customerSchema),
  status: Type.Unsafe<SubscriptionStatus>(Type.Enum(SubscriptionStatusEnum)),
  currency: Type.Unsafe<Currency>(Type.Enum(CurrencyEnum)),
  collectionMethod: Type.Unsafe<CollectionMethod>(Type.Enum(CollectionMethodEnum)),
  billingMode: Type.Unsafe<BillingMode>(Type.Enum(BillingModeEnum)),
  items: Type.Array(subscriptionItemSchema),
  billingCycleAnchor: Type.String(),
  currentPeriodStart: Type.String(),
  currentPeriodEnd: Type.String(),
  chargedThroughDate: Type.Union([Type.String(), Type.Null()]),
  defaultTaxRates: Type.Array(Type.String()),
  defaultPaymentMethodId: Type.Union([Type.String(), Type.Null()]),
  trialStart: Type.Union([Type.String(), Type.Null()]),
  trialEnd: Type.Union([Type.String(), Type.Null()]),
  trialSettings: Type.Object({
    endBehavior: Type.Object({
      missingPaymentMethod: Type.Unsafe<TrialEndBehavior>(Type.Enum(TrialEndBehaviorEnum)),
    }),
  }),
  pauseCollection: Type.Union([
    Type.Object({
      behavior: Type.Unsafe<PauseCollectionBehavior>(Type.Enum(PauseCollectionBehaviorEnum)),
      resumesAt: Type.Union([Type.String(), Type.Null()]),
    }),
    Type.Null(),
  ]),
  cancelAtPeriodEnd: Type.Boolean(),
  cancelAt: Type.Union([Type.String(), Type.Null()]),
  cancellationDetails: Type.Object({
    reason: Type.Union([
      Type.Unsafe<CancellationReason>(Type.Enum(CancellationReasonEnum)),
      Type.Null(),
    ]),
    comment: Type.Union([Type.String(), Type.Null()]),
    feedback: Type.Union([Type.String(), Type.Null()]),
  }),
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
        taxRates: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
        metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
      }),
      { minItems: 1 },
    ),
    trialPeriodDays: Type.Optional(Type.Integer({ minimum: 1, maximum: 730 })),
    trialEnd: Type.Optional(Type.String({ format: 'date-time' })),
    trialSettings: Type.Optional(
      Type.Object({
        endBehavior: Type.Object({
          missingPaymentMethod: Type.Unsafe<TrialEndBehavior>(Type.Enum(TrialEndBehaviorEnum)),
        }),
      }),
    ),
    billingCycleAnchor: Type.Optional(Type.String({ format: 'date-time' })),
    collectionMethod: Type.Optional(Type.Unsafe<CollectionMethod>(Type.Enum(CollectionMethodEnum))),
    billingMode: Type.Optional(Type.Unsafe<BillingMode>(Type.Enum(BillingModeEnum))),
    defaultTaxRates: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
    defaultPaymentMethodId: Type.Optional(Type.String({ minLength: 1 })),
    cancelAt: Type.Optional(Type.String({ format: 'date-time' })),
    metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
  },
  { additionalProperties: false },
);

export const updateSubscriptionSchema = Type.Object(
  {
    items: Type.Optional(
      Type.Array(
        Type.Object({
          id: Type.Optional(Type.String({ minLength: 1 })),
          priceId: Type.String({ minLength: 1 }),
          quantity: Type.Optional(Type.Integer({ minimum: 1 })),
          taxRates: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
          metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
        }),
        { minItems: 1 },
      ),
    ),
    prorationBehavior: Type.Optional(
      Type.Unsafe<ProrationBehavior>(Type.Enum(ProrationBehaviorEnum)),
    ),
    cancelAtPeriodEnd: Type.Optional(Type.Boolean()),
    cancelAt: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
    pauseCollection: Type.Optional(
      Type.Union([
        Type.Object({
          behavior: Type.Unsafe<PauseCollectionBehavior>(Type.Enum(PauseCollectionBehaviorEnum)),
          resumesAt: Type.Optional(Type.String({ format: 'date-time' })),
        }),
        Type.Null(),
      ]),
    ),
    trialSettings: Type.Optional(
      Type.Object({
        endBehavior: Type.Object({
          missingPaymentMethod: Type.Unsafe<TrialEndBehavior>(Type.Enum(TrialEndBehaviorEnum)),
        }),
      }),
    ),
    collectionMethod: Type.Optional(Type.Unsafe<CollectionMethod>(Type.Enum(CollectionMethodEnum))),
    defaultTaxRates: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
    defaultPaymentMethodId: Type.Optional(Type.Union([Type.String({ minLength: 1 }), Type.Null()])),
    metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
  },
  { additionalProperties: false },
);

export const cancelSubscriptionSchema = Type.Object(
  {
    cancelAtPeriodEnd: Type.Optional(Type.Boolean()),
    cancelAt: Type.Optional(Type.String({ format: 'date-time' })),
    cancellationDetails: Type.Optional(
      Type.Object({
        comment: Type.Optional(Type.String()),
        feedback: Type.Optional(Type.String()),
      }),
    ),
    comment: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export const subscriptionItemParamsSchema = Type.Object({
  subscriptionItemId: Type.String(),
});

export const createSubscriptionItemSchema = Type.Object(
  {
    subscriptionId: Type.String({ minLength: 1 }),
    priceId: Type.String({ minLength: 1 }),
    quantity: Type.Optional(Type.Integer({ minimum: 1 })),
    taxRates: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
    prorationBehavior: Type.Optional(
      Type.Unsafe<ProrationBehavior>(Type.Enum(ProrationBehaviorEnum)),
    ),
    metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
  },
  { additionalProperties: false },
);

export const updateSubscriptionItemSchema = Type.Object(
  {
    priceId: Type.Optional(Type.String({ minLength: 1 })),
    quantity: Type.Optional(Type.Integer({ minimum: 1 })),
    taxRates: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
    prorationBehavior: Type.Optional(
      Type.Unsafe<ProrationBehavior>(Type.Enum(ProrationBehaviorEnum)),
    ),
    metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
  },
  { additionalProperties: false },
);

export const deleteSubscriptionItemSchema = Type.Object(
  {
    prorationBehavior: Type.Optional(
      Type.Unsafe<ProrationBehavior>(Type.Enum(ProrationBehaviorEnum)),
    ),
  },
  { additionalProperties: false },
);

export const findSubscriptionItemsSchema = Type.Object(
  {
    subscriptionId: Type.String({ minLength: 1 }),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
    expand: Type.Optional(Type.Array(Type.String())),
  },
  { additionalProperties: false },
);

export const deletedSubscriptionItemSchema = Type.Object({
  id: Type.String(),
  deleted: Type.Literal(true),
});

export const findSubscriptionsSchema = Type.Object(
  {
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
    after: Type.Optional(Type.String()),
    before: Type.Optional(Type.String()),
    customerId: Type.Optional(Type.String()),
    status: Type.Optional(Type.Unsafe<SubscriptionStatus>(Type.Enum(SubscriptionStatusEnum))),
    expand: Type.Optional(Type.Array(Type.String())),
  },
  { additionalProperties: false },
);

export type SubscriptionResponse = Static<typeof subscriptionSchema>;
export type SubscriptionItemResponse = Static<typeof subscriptionItemSchema>;
export type CreateSubscriptionPayload = Static<typeof createSubscriptionSchema>;
export type UpdateSubscriptionPayload = Static<typeof updateSubscriptionSchema>;
export type CancelSubscriptionPayload = Static<typeof cancelSubscriptionSchema>;
export type FindSubscriptionsQuery = Static<typeof findSubscriptionsSchema>;
export type CreateSubscriptionItemPayload = Static<typeof createSubscriptionItemSchema>;
export type UpdateSubscriptionItemPayload = Static<typeof updateSubscriptionItemSchema>;
export type DeleteSubscriptionItemPayload = Static<typeof deleteSubscriptionItemSchema>;
export type FindSubscriptionItemsQuery = Static<typeof findSubscriptionItemsSchema>;
export type DeletedSubscriptionItemResponse = Static<typeof deletedSubscriptionItemSchema>;
