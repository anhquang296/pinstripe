import type { Static } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';

export enum UserRoleEnum {
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  MEMBER = 'member',
}
export type UserRole = `${UserRoleEnum}`;

export enum UserStatusEnum {
  ACTIVE = 'active',
  DISABLED = 'disabled',
}
export type UserStatus = `${UserStatusEnum}`;

export enum PermissionEnum {
  BILLING_READ = 'billing.read',
  CUSTOMER_WRITE = 'customer.write',
  CUSTOMER_DELETE = 'customer.delete',
  CATALOG_WRITE = 'catalog.write',
  SUBSCRIPTION_WRITE = 'subscription.write',
  INVOICE_WRITE = 'invoice.write',
  INVOICE_VOID = 'invoice.void',
  CREDIT_NOTE_WRITE = 'credit_note.write',
  REFUND_WRITE = 'refund.write',
  LEDGER_WRITE = 'ledger.write',
  INTEGRATION_WRITE = 'integration.write',
  TEST_CLOCK_WRITE = 'test_clock.write',
  API_KEY_MANAGE = 'api_key.manage',
  USER_MANAGE = 'user.manage',
  PORTAL_WRITE = 'portal.write',
}
export type Permission = `${PermissionEnum}`;

const ADMIN_PERMISSIONS: readonly Permission[] = [
  PermissionEnum.BILLING_READ,
  PermissionEnum.CUSTOMER_WRITE,
  PermissionEnum.CUSTOMER_DELETE,
  PermissionEnum.CATALOG_WRITE,
  PermissionEnum.SUBSCRIPTION_WRITE,
  PermissionEnum.INVOICE_WRITE,
  PermissionEnum.INVOICE_VOID,
  PermissionEnum.CREDIT_NOTE_WRITE,
  PermissionEnum.REFUND_WRITE,
  PermissionEnum.LEDGER_WRITE,
  PermissionEnum.INTEGRATION_WRITE,
  PermissionEnum.TEST_CLOCK_WRITE,
  PermissionEnum.API_KEY_MANAGE,
  PermissionEnum.USER_MANAGE,
];

const MODERATOR_PERMISSIONS: readonly Permission[] = [
  PermissionEnum.BILLING_READ,
  PermissionEnum.CUSTOMER_WRITE,
  PermissionEnum.CATALOG_WRITE,
  PermissionEnum.SUBSCRIPTION_WRITE,
  PermissionEnum.INVOICE_WRITE,
  PermissionEnum.TEST_CLOCK_WRITE,
];

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  [UserRoleEnum.ADMIN]: ADMIN_PERMISSIONS,
  [UserRoleEnum.MODERATOR]: MODERATOR_PERMISSIONS,
  [UserRoleEnum.MEMBER]: [PermissionEnum.BILLING_READ],
};

export const userSchema = Type.Object({
  id: Type.String(),
  email: Type.String(),
  name: Type.String(),
  role: Type.Unsafe<UserRole>(Type.Enum(UserRoleEnum)),
  status: Type.Unsafe<UserStatus>(Type.Enum(UserStatusEnum)),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

export const userParamsSchema = Type.Object({
  userId: Type.String(),
});

export const createUserSchema = Type.Object(
  {
    email: Type.String({ format: 'email', maxLength: 320 }),
    name: Type.String({ minLength: 1, maxLength: 200 }),
    role: Type.Unsafe<UserRole>(Type.Enum(UserRoleEnum)),
    password: Type.Optional(Type.String({ minLength: 12, maxLength: 200 })),
  },
  { additionalProperties: false },
);

export const updateUserSchema = Type.Object(
  {
    name: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
    role: Type.Optional(Type.Unsafe<UserRole>(Type.Enum(UserRoleEnum))),
    status: Type.Optional(Type.Unsafe<UserStatus>(Type.Enum(UserStatusEnum))),
    password: Type.Optional(Type.String({ minLength: 12, maxLength: 200 })),
  },
  { additionalProperties: false },
);

export const bootstrapUserSchema = Type.Object(
  {
    email: Type.String({ format: 'email', maxLength: 320 }),
    name: Type.String({ minLength: 1, maxLength: 200 }),
    password: Type.String({ minLength: 12, maxLength: 200 }),
  },
  { additionalProperties: false },
);

export const findUsersSchema = Type.Object(
  {
    role: Type.Optional(Type.Unsafe<UserRole>(Type.Enum(UserRoleEnum))),
    status: Type.Optional(Type.Unsafe<UserStatus>(Type.Enum(UserStatusEnum))),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
    after: Type.Optional(Type.String()),
    before: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export const createSessionSchema = Type.Object(
  {
    email: Type.String({ minLength: 3, maxLength: 320 }),
    password: Type.String({ minLength: 1, maxLength: 200 }),
  },
  { additionalProperties: false },
);

export const updatePasswordSchema = Type.Object(
  {
    currentPassword: Type.String({ minLength: 1, maxLength: 200 }),
    newPassword: Type.String({ minLength: 12, maxLength: 200 }),
  },
  { additionalProperties: false },
);

export const accountSchema = Type.Object({
  user: userSchema,
  permissions: Type.Array(Type.Unsafe<Permission>(Type.Enum(PermissionEnum))),
});

export const authProvidersSchema = Type.Object({
  isGoogleEnabled: Type.Boolean(),
});

export type UserResponse = Static<typeof userSchema>;
export type CreateUserPayload = Static<typeof createUserSchema>;
export type UpdateUserPayload = Static<typeof updateUserSchema>;
export type FindUsersQuery = Static<typeof findUsersSchema>;
export type CreateSessionPayload = Static<typeof createSessionSchema>;
export type UpdatePasswordPayload = Static<typeof updatePasswordSchema>;
export type AccountResponse = Static<typeof accountSchema>;
export type AuthProvidersResponse = Static<typeof authProvidersSchema>;

export interface UserAuth {
  userId: string;
  sessionId: string;
  role: UserRole;
  permissions: readonly Permission[];
}
