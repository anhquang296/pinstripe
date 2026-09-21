import type { ErpModule } from '@contracts/modules.types';
import { ErpModuleEnum } from '@contracts/modules.types';
import type { Permission } from '@contracts/users.types';
import { PermissionEnum } from '@contracts/users.types';
import type { Static } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';

export enum ApiKeyTypeEnum {
  SECRET = 'secret',
  RESTRICTED = 'restricted',
  PUBLISHABLE = 'publishable',
}
export type ApiKeyType = `${ApiKeyTypeEnum}`;

export const apiKeySchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  module: Type.Union([Type.Unsafe<ErpModule>(Type.Enum(ErpModuleEnum)), Type.Null()]),
  type: Type.Unsafe<ApiKeyType>(Type.Enum(ApiKeyTypeEnum)),
  permissions: Type.Array(Type.Unsafe<Permission>(Type.Enum(PermissionEnum))),
  tokenPrefix: Type.String(),
  token: Type.Union([Type.String(), Type.Null()]),
  lastUsedAt: Type.Union([Type.String(), Type.Null()]),
  revokedAt: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
});

export const apiKeyParamsSchema = Type.Object({
  apiKeyId: Type.String(),
});

export const createApiKeySchema = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 100 }),
    module: Type.Unsafe<ErpModule>(Type.Enum(ErpModuleEnum)),
    type: Type.Unsafe<ApiKeyType>(Type.Enum(ApiKeyTypeEnum)),
    permissions: Type.Array(Type.Unsafe<Permission>(Type.Enum(PermissionEnum)), { minItems: 1 }),
  },
  { additionalProperties: false },
);

export const findApiKeysSchema = Type.Object(
  {
    module: Type.Optional(Type.Unsafe<ErpModule>(Type.Enum(ErpModuleEnum))),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
    after: Type.Optional(Type.String()),
    before: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export type ApiKeyResponse = Static<typeof apiKeySchema>;
export type CreateApiKeyPayload = Static<typeof createApiKeySchema>;
export type FindApiKeysQuery = Static<typeof findApiKeysSchema>;

export interface RequestAuth {
  apiKeyId: string;
  type: ApiKeyType;
  permissions: readonly Permission[];
}
