import { buildApp } from '@app';
import type { ApiKeyScope, ApiKeyType } from '@pinstripe/core/contracts';
import { ApiKeyScopeEnum, ApiKeyTypeEnum } from '@pinstripe/core/contracts';
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
  scopes: readonly ApiKeyScope[],
  overrides: { type?: ApiKeyType } = {},
): Promise<MintedApiKey> {
  const { type = ApiKeyTypeEnum.SECRET } = overrides;

  const apiKey = await fastify.apiKeyService.createApiKey({
    name: `test ${scopes.join('-')}`,
    type,
    scopes: [...scopes],
  });

  if (apiKey.token) {
    return { id: apiKey.id, token: apiKey.token };
  }

  throw new Error('test fixture minted an api key without a token');
}

export function buildAuthHeaders(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

export const ALL_SCOPES = [
  ApiKeyScopeEnum.V1,
  ApiKeyScopeEnum.ADMIN,
  ApiKeyScopeEnum.SYSTEM,
  ApiKeyScopeEnum.MANAGEMENT,
] as const;
