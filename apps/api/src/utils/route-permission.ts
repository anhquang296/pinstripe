import { OPERATION_PERMISSIONS, READ_OPERATION_PREFIXES } from '@constants/permissions';
import type { Permission } from '@vxrerp/core/contracts';
import { PermissionEnum } from '@vxrerp/core/contracts';
import type { FastifyContextConfig, FastifyRequest } from 'fastify';
import _ from 'lodash';

declare module 'fastify' {
  interface FastifyContextConfig {
    permission?: Permission;
  }
}

export function buildRouteConfig(permission: Permission): FastifyContextConfig {
  return { permission };
}

function isReadOperation(method: string): boolean {
  return _.some(READ_OPERATION_PREFIXES, (prefix) => {
    return _.startsWith(method, prefix);
  });
}

export function resolveOperationPermission(operationId: string): Permission | null {
  const segments = _.split(operationId, '.');
  const method = _.last(segments);
  const resource = _.join(_.initial(segments), '.');

  if (resource && method) {
    const operationPermission = _.get(OPERATION_PERMISSIONS, [operationId], null);

    if (operationPermission) {
      return operationPermission;
    }

    if (isReadOperation(method)) {
      return PermissionEnum.BILLING_READ;
    }

    return _.get(OPERATION_PERMISSIONS, [resource], null);
  }

  return null;
}

export function resolveRoutePermission(request: FastifyRequest): Permission | null {
  const { permission } = request.routeOptions.config;

  if (permission) {
    return permission;
  }

  const operationId = _.get(request.routeOptions, 'schema.operationId');

  if (_.isString(operationId)) {
    return resolveOperationPermission(operationId);
  }

  return null;
}
