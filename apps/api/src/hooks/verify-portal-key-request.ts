import { authenticateApiKey } from '@hooks/authenticate-request';
import { PermissionEnum } from '@vxrerp/platform/contracts';
import { ForbiddenError } from '@vxrerp/platform/errors';
import { ApiKeyService } from '@vxrerp/platform/services';
import type { FastifyRequest } from 'fastify';

export async function verifyPortalKeyRequest(request: FastifyRequest): Promise<void> {
  await authenticateApiKey(request);

  const { auth } = request;

  if (auth && ApiKeyService.hasPermission(auth, PermissionEnum.PORTAL_WRITE)) {
    return;
  }

  throw new ForbiddenError('This API key is not permitted to open a portal session');
}
