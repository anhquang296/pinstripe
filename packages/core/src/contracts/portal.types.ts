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
  livemode: Type.Boolean(),
  customerId: Type.String(),
  status: Type.Unsafe<PortalSessionStatus>(Type.Enum(PortalSessionStatusEnum)),
  sessionKey: Type.Union([Type.String(), Type.Null()]),
  linkExpiresAt: Type.String(),
  sessionExpiresAt: Type.Union([Type.String(), Type.Null()]),
  redeemedAt: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
});

export const portalLinkSchema = Type.Object({
  livemode: Type.Boolean(),
  linkExpiresAt: Type.String(),
});

export const portalIdentitySchema = Type.Object({
  customerId: Type.String(),
  email: Type.Union([Type.String(), Type.Null()]),
  name: Type.String(),
  currency: Type.String(),
  sessionExpiresAt: Type.Union([Type.String(), Type.Null()]),
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

export interface PortalAuth {
  portalSessionId: string;
  customerId: string;
  livemode: boolean;
}
