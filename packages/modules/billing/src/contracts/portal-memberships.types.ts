import type { Static } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';

export enum PortalRoleEnum {
  OWNER = 'owner',
  ACCOUNTANT = 'accountant',
}
export type PortalRole = `${PortalRoleEnum}`;

export const portalMembershipSchema = Type.Object({
  id: Type.String(),
  customerId: Type.String(),
  portalUserId: Type.String(),
  email: Type.String(),
  name: Type.String(),
  role: Type.Unsafe<PortalRole>(Type.Enum(PortalRoleEnum)),
  createdAt: Type.String(),
});

export const portalMembershipParamsSchema = Type.Object({
  portalMembershipId: Type.String({ minLength: 1 }),
});

export const findPortalMembershipsSchema = Type.Object(
  {
    customerId: Type.String({ minLength: 1 }),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 50 })),
  },
  { additionalProperties: false },
);

export const createPortalMembershipSchema = Type.Object(
  {
    customerId: Type.String({ minLength: 1 }),
    email: Type.String({ format: 'email', maxLength: 320 }),
    name: Type.Optional(Type.String({ maxLength: 200 })),
    role: Type.Unsafe<PortalRole>(Type.Enum(PortalRoleEnum)),
  },
  { additionalProperties: false },
);

export const updatePortalMembershipSchema = Type.Object(
  {
    role: Type.Unsafe<PortalRole>(Type.Enum(PortalRoleEnum)),
  },
  { additionalProperties: false },
);

export const deletedPortalMembershipSchema = Type.Object({
  id: Type.String(),
  deleted: Type.Literal(true),
});

export type PortalMembershipResponse = Static<typeof portalMembershipSchema>;
export type FindPortalMembershipsQuery = Static<typeof findPortalMembershipsSchema>;
export type CreatePortalMembershipPayload = Static<typeof createPortalMembershipSchema>;
export type UpdatePortalMembershipPayload = Static<typeof updatePortalMembershipSchema>;
export type DeletedPortalMembershipResponse = Static<typeof deletedPortalMembershipSchema>;
