import { buildApp } from '@app';
import type { ApiKeyType, Permission } from '@vxrerp/platform/contracts';
import { ApiKeyTypeEnum, PermissionEnum } from '@vxrerp/platform/contracts';
import type { FastifyInstance } from 'fastify';

export interface MintedApiKey {
  id: string;
  token: string;
}

export async function buildTestApp(): Promise<FastifyInstance> {
  const fastify = await buildApp();

  await fastify.ready();

  return fastify;
}

export async function mintApiKey(
  fastify: FastifyInstance,
  permissions: readonly Permission[],
  overrides: { type?: ApiKeyType } = {},
): Promise<MintedApiKey> {
  const { type = ApiKeyTypeEnum.SECRET } = overrides;

  const apiKey = await fastify.apiKeyService.createApiKey({
    name: `test ${permissions.join('-')}`,
    type,
    permissions: [...permissions],
  });

  if (apiKey.token) {
    return { id: apiKey.id, token: apiKey.token };
  }

  throw new Error('test fixture minted an api key without a token');
}

export function buildAuthHeaders(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

export const ALL_PERMISSIONS: readonly Permission[] = Object.values(PermissionEnum);
