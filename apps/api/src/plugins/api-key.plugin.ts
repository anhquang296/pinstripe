import type { Permission, RequestAuth, UserAuth } from '@vxrerp/core/contracts';
import { ApiKeyTypeEnum, PermissionEnum } from '@vxrerp/core/contracts';
import type { BootstrapApiKey } from '@vxrerp/core/services';
import fp from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyRequest {
    auth?: RequestAuth;
    actor?: UserAuth;
  }
}

const SECRET_KEY_PERMISSIONS: readonly Permission[] = Object.values(PermissionEnum);

export const apiKeyPlugin = fp(async (fastify) => {
  const { SECRET_API_KEY, PORTAL_API_KEY } = fastify.config;

  const bootstrapKeys: BootstrapApiKey[] = [
    { name: 'bootstrap secret', token: SECRET_API_KEY, permissions: SECRET_KEY_PERMISSIONS },
  ];

  if (PORTAL_API_KEY) {
    bootstrapKeys.push({
      name: 'bootstrap portal',
      token: PORTAL_API_KEY,
      permissions: [PermissionEnum.PORTAL_WRITE],
      type: ApiKeyTypeEnum.PUBLISHABLE,
    });
  }

  await fastify.apiKeyService.ensureBootstrapApiKeys(bootstrapKeys);
});
