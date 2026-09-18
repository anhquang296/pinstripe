import type { Static } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';

export enum ApiKeyTypeEnum {
  SECRET = 'secret',
  RESTRICTED = 'restricted',
  PUBLISHABLE = 'publishable',
}
export type ApiKeyType = `${ApiKeyTypeEnum}`;

export enum ApiKeyScopeEnum {
  V1 = 'v1',
  ADMIN = 'admin',
  SYSTEM = 'system',
  MANAGEMENT = 'management',
  PORTAL = 'portal',
}
export type ApiKeyScope = `${ApiKeyScopeEnum}`;

export const apiKeySchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  type: Type.Unsafe<ApiKeyType>(Type.Enum(ApiKeyTypeEnum)),
  scopes: Type.Array(Type.Unsafe<ApiKeyScope>(Type.Enum(ApiKeyScopeEnum))),
  livemode: Type.Boolean(),
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
    type: Type.Unsafe<ApiKeyType>(Type.Enum(ApiKeyTypeEnum)),
    scopes: Type.Array(Type.Unsafe<ApiKeyScope>(Type.Enum(ApiKeyScopeEnum)), { minItems: 1 }),
    livemode: Type.Boolean(),
  },
  { additionalProperties: false },
);

export const findApiKeysSchema = Type.Object(
  {
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
    startingAfter: Type.Optional(Type.String()),
    endingBefore: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export type ApiKeyResponse = Static<typeof apiKeySchema>;
export type CreateApiKeyPayload = Static<typeof createApiKeySchema>;
export type FindApiKeysQuery = Static<typeof findApiKeysSchema>;

export interface RequestAuth {
  apiKeyId: string;
  type: ApiKeyType;
  scopes: readonly ApiKeyScope[];
  livemode: boolean;
}
