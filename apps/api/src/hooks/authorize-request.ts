import type { UserAuth } from '@pinstripe/core/contracts';
import { ForbiddenError } from '@pinstripe/core/errors';
import { resolveRoutePermission } from '@utils/route-permission';
import type { FastifyRequest } from 'fastify';
import _ from 'lodash';

function assertActorPermission(request: FastifyRequest, actor: UserAuth): void {
  const permission = resolveRoutePermission(request);

  if (permission && _.includes(actor.permissions, permission)) {
    return;
  }

  throw new ForbiddenError(`The ${actor.role} role is not permitted to call this route`);
}

export function authorizeRequest(request: FastifyRequest): void {
  const { actor } = request;

  if (actor) {
    assertActorPermission(request, actor);
  }
}
