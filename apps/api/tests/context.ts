import { randomBytes } from 'node:crypto';

import { buildApp } from '@app';
import type { ApiKeyType, Permission } from '@vxrerp/platform/contracts';
import { ApiKeyTypeEnum, PERMISSION_MODULES, PermissionEnum } from '@vxrerp/platform/contracts';
import { ApiKeyService } from '@vxrerp/platform/services';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

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

  const name = `test ${permissions.join('-')}`;

  const [module, ...otherModules] = _.uniq(
    _.map(permissions, (permission) => {
      return PERMISSION_MODULES[permission];
    }),
  );

  if (module && _.isEmpty(otherModules)) {
    const apiKey = await fastify.apiKeyService.createApiKey({
      name,
      module,
      type,
      permissions: [...permissions],
    });

    if (apiKey.token) {
      return { id: apiKey.id, token: apiKey.token };
    }

    throw new Error('test fixture minted an api key without a token');
  }

  const token = `sk_${randomBytes(24).toString('hex')}`;

  await fastify.apiKeyService.ensureBootstrapApiKeys([
    { name, module: null, token, permissions, type },
  ]);

  const [platformApiKey] = await fastify.apiKeyRepository.findApiKeys(
    { tokenHash: ApiKeyService.hashToken(token) },
    1,
  );

  if (platformApiKey) {
    return { id: platformApiKey.id, token };
  }

  throw new Error('test fixture could not mint a platform api key');
}

export function buildAuthHeaders(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

export const ALL_PERMISSIONS: readonly Permission[] = Object.values(PermissionEnum);
