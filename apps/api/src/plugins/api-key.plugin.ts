import type { RequestAuth } from '@pinstripe/core/contracts';
import { ApiKeyScopeEnum, ApiKeyTypeEnum } from '@pinstripe/core/contracts';
import type { BootstrapApiKey } from '@pinstripe/core/services';
import fp from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyRequest {
    auth?: RequestAuth;
  }
}

export const apiKeyPlugin = fp(async (fastify) => {
  const { SECRET_API_KEY, ADMIN_API_KEY, SYSTEM_API_KEY, MANAGEMENT_API_KEY, PORTAL_API_KEY } =
    fastify.config;

  const bootstrapKeys: BootstrapApiKey[] = [
    { name: 'bootstrap secret', token: SECRET_API_KEY, scopes: [ApiKeyScopeEnum.V1] },
    { name: 'bootstrap admin', token: ADMIN_API_KEY, scopes: [ApiKeyScopeEnum.ADMIN] },
    { name: 'bootstrap system', token: SYSTEM_API_KEY, scopes: [ApiKeyScopeEnum.SYSTEM] },
    {
      name: 'bootstrap management',
      token: MANAGEMENT_API_KEY,
      scopes: [ApiKeyScopeEnum.MANAGEMENT],
    },
  ];

  if (PORTAL_API_KEY) {
    bootstrapKeys.push({
      name: 'bootstrap portal',
      token: PORTAL_API_KEY,
      scopes: [ApiKeyScopeEnum.PORTAL],
      type: ApiKeyTypeEnum.PUBLISHABLE,
    });
  }

  await fastify.apiKeyService.ensureBootstrapApiKeys(bootstrapKeys);
});
