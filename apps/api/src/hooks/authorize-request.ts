import type { Permission } from '@pinstripe/core/contracts';
import { ForbiddenError } from '@pinstripe/core/errors';
import { resolveRoutePermission } from '@utils/route-permission';
import type { FastifyRequest } from 'fastify';
import _ from 'lodash';

function readActorPermissions(request: FastifyRequest): readonly Permission[] {
  const { actor, auth } = request;

  if (actor) {
    return actor.permissions;
  }

  if (auth) {
    return auth.permissions;
  }

  return [];
}

export function authorizeRequest(request: FastifyRequest): void {
  const permission = resolveRoutePermission(request);
  const permissions = readActorPermissions(request);

  if (permission && _.includes(permissions, permission)) {
    return;
  }

  throw new ForbiddenError('This caller is not permitted to call this route');
}
