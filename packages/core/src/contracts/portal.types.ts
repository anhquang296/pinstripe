import { InvoiceStatusEnum } from '@contracts/invoices.types';
import type { RecurringInterval, UsageType } from '@contracts/prices.types';
import { RecurringIntervalEnum, UsageTypeEnum } from '@contracts/prices.types';
import type { CollectionMethod, SubscriptionStatus } from '@contracts/subscriptions.types';
import { CollectionMethodEnum, SubscriptionStatusEnum } from '@contracts/subscriptions.types';
import type { Static } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';

export enum PortalSessionStatusEnum {
  PENDING = 'pending',
  ACTIVE = 'active',
  REVOKED = 'revoked',
}
export type PortalSessionStatus = `${PortalSessionStatusEnum}`;

export const portalSessionSchema = Type.Object({
  id: Type.String(),
  customerId: Type.String(),
  status: Type.Unsafe<PortalSessionStatus>(Type.Enum(PortalSessionStatusEnum)),
  sessionKey: Type.Union([Type.String(), Type.Null()]),
  linkExpiresAt: Type.String(),
  sessionExpiresAt: Type.Union([Type.String(), Type.Null()]),
  redeemedAt: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
});

export const portalLinkSchema = Type.Object({
  linkExpiresAt: Type.String(),
});

export const portalIdentitySchema = Type.Object({
  customerId: Type.String(),
  email: Type.Union([Type.String(), Type.Null()]),
  name: Type.String(),
  phone: Type.String(),
  taxId: Type.Union([Type.String(), Type.Null()]),
  address: Type.Union([
    Type.Object({
      line1: Type.Optional(Type.String()),
      line2: Type.Optional(Type.String()),
      city: Type.Optional(Type.String()),
      state: Type.Optional(Type.String()),
      postalCode: Type.Optional(Type.String()),
      country: Type.Optional(Type.String()),
    }),
    Type.Null(),
  ]),
  currency: Type.String(),
  sessionExpiresAt: Type.Union([Type.String(), Type.Null()]),
});

export const portalSubscriptionSchema = Type.Object({
  id: Type.String(),
  status: Type.Unsafe<SubscriptionStatus>(Type.Enum(SubscriptionStatusEnum)),
  currency: Type.String(),
  collectionMethod: Type.Unsafe<CollectionMethod>(Type.Enum(CollectionMethodEnum)),
  currentPeriodStart: Type.String(),
  currentPeriodEnd: Type.String(),
  trialEnd: Type.Union([Type.String(), Type.Null()]),
  cancelAtPeriodEnd: Type.Boolean(),
  cancelAt: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
  items: Type.Array(
    Type.Object({
      id: Type.String(),
      quantity: Type.Integer(),
      productName: Type.String(),
      priceNickname: Type.String(),
      unitAmount: Type.Union([Type.Integer(), Type.Null()]),
      interval: Type.Union([
        Type.Unsafe<RecurringInterval>(Type.Enum(RecurringIntervalEnum)),
        Type.Null(),
      ]),
      intervalCount: Type.Union([Type.Integer(), Type.Null()]),
      usageType: Type.Union([Type.Unsafe<UsageType>(Type.Enum(UsageTypeEnum)), Type.Null()]),
    }),
  ),
});

export const portalInvoiceParamsSchema = Type.Object({
  invoiceId: Type.String({ minLength: 1 }),
});

export const portalInvoiceTotalsSchema = Type.Object({
  totals: Type.Array(
    Type.Object({
      currency: Type.String(),
      openAmount: Type.Integer(),
      openCount: Type.Integer(),
      overdueAmount: Type.Integer(),
      overdueCount: Type.Integer(),
      dueSoonAmount: Type.Integer(),
      dueSoonCount: Type.Integer(),
      nextDueAt: Type.Union([Type.String(), Type.Null()]),
    }),
  ),
});

export const createPortalLinkSchema = Type.Object(
  {
    email: Type.String({ minLength: 3, maxLength: 320 }),
  },
  { additionalProperties: false },
);

export const redeemPortalLinkSchema = Type.Object(
  {
    linkKey: Type.String({ minLength: 16 }),
  },
  { additionalProperties: false },
);

export const findPortalInvoicesSchema = Type.Object(
  {
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
    startingAfter: Type.Optional(Type.String()),
    endingBefore: Type.Optional(Type.String()),
    status: Type.Optional(
      Type.Union([
        Type.Literal(InvoiceStatusEnum.OPEN),
        Type.Literal(InvoiceStatusEnum.PAID),
        Type.Literal(InvoiceStatusEnum.UNCOLLECTIBLE),
        Type.Literal(InvoiceStatusEnum.VOID),
      ]),
    ),
    isOverdue: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

export const findPortalSubscriptionsSchema = Type.Object(
  {
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
    startingAfter: Type.Optional(Type.String()),
    endingBefore: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export const findPortalPaymentMethodsSchema = Type.Object(
  {
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
    startingAfter: Type.Optional(Type.String()),
    endingBefore: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export type PortalSessionResponse = Static<typeof portalSessionSchema>;
export type PortalLinkResponse = Static<typeof portalLinkSchema>;
export type PortalIdentityResponse = Static<typeof portalIdentitySchema>;
export type CreatePortalLinkPayload = Static<typeof createPortalLinkSchema>;
export type RedeemPortalLinkPayload = Static<typeof redeemPortalLinkSchema>;
export type FindPortalInvoicesQuery = Static<typeof findPortalInvoicesSchema>;
export type FindPortalSubscriptionsQuery = Static<typeof findPortalSubscriptionsSchema>;
export type FindPortalPaymentMethodsQuery = Static<typeof findPortalPaymentMethodsSchema>;
export type PortalInvoiceTotalsResponse = Static<typeof portalInvoiceTotalsSchema>;
export type PortalSubscriptionResponse = Static<typeof portalSubscriptionSchema>;

export interface PortalAuth {
  portalSessionId: string;
  customerId: string;
}
