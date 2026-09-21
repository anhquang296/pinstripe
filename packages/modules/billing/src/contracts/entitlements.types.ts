import type { Static } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';

export enum EntitlementStatusEnum {
  ACTIVE = 'active',
  BLOCKED = 'blocked',
  REVOKED = 'revoked',
}
export type EntitlementStatus = `${EntitlementStatusEnum}`;

export const entitlementSchema = Type.Object({
  id: Type.String(),
  customerId: Type.String(),
  customer: Type.Optional(Type.Unknown()),
  subscriptionId: Type.String(),
  productId: Type.String(),
  product: Type.Optional(Type.Unknown()),
  status: Type.Unsafe<EntitlementStatus>(Type.Enum(EntitlementStatusEnum)),
  grantedAt: Type.String(),
  revokedAt: Type.Union([Type.String(), Type.Null()]),
  updatedAt: Type.String(),
});

export const findEntitlementsSchema = Type.Object(
  {
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
    after: Type.Optional(Type.String()),
    before: Type.Optional(Type.String()),
    customerId: Type.Optional(Type.String()),
    productId: Type.Optional(Type.String()),
    expand: Type.Optional(Type.Array(Type.String())),
  },
  { additionalProperties: false },
);

export type EntitlementResponse = Static<typeof entitlementSchema>;
export type FindEntitlementsQuery = Static<typeof findEntitlementsSchema>;
