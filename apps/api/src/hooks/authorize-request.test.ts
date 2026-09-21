import type { Permission } from '@vxrerp/platform/contracts';
import {
  ApiKeyTypeEnum,
  PermissionEnum,
  ROLE_PERMISSIONS,
  UserRoleEnum,
} from '@vxrerp/platform/contracts';
import { ForbiddenError } from '@vxrerp/platform/errors';
import type { FastifyRequest } from 'fastify';
import { expect, it } from 'vitest';

import { authorizeRequest } from './authorize-request';

interface SetupOverrides {
  role?: UserRoleEnum;
  operationId?: string;
  permission?: Permission;
  keyPermissions?: readonly Permission[];
}

function setup(overrides: SetupOverrides = {}) {
  const { role, operationId, permission, keyPermissions } = overrides;

  const actor = role
    ? { userId: 'usr_1', sessionId: 'ases_1', role, permissions: ROLE_PERMISSIONS[role] }
    : undefined;

  const auth = keyPermissions
    ? { apiKeyId: 'key_1', type: ApiKeyTypeEnum.RESTRICTED, permissions: keyPermissions }
    : undefined;

  const request = {
    actor,
    auth,
    routeOptions: { config: { permission }, schema: { operationId } },
  } as unknown as FastifyRequest;

  return { request };
}

it('lets a session through when its role carries the permission of the route', () => {
  const { request } = setup({ role: UserRoleEnum.MEMBER, operationId: 'customers.find' });

  expect(() => {
    authorizeRequest(request);
  }).not.toThrow();
});

it('throws ForbiddenError when the role misses the permission of the route', () => {
  const { request } = setup({ role: UserRoleEnum.MEMBER, operationId: 'customers.create' });

  expect(() => {
    authorizeRequest(request);
  }).toThrow(ForbiddenError);
});

it('lets an api key through when it carries the permission of the route', () => {
  const { request } = setup({
    keyPermissions: [PermissionEnum.LEDGER_WRITE],
    operationId: 'ledger.transactions.create',
  });

  expect(() => {
    authorizeRequest(request);
  }).not.toThrow();
});

it('throws ForbiddenError when the api key misses the permission of the route', () => {
  const { request } = setup({
    keyPermissions: [PermissionEnum.BILLING_READ],
    operationId: 'ledger.transactions.create',
  });

  expect(() => {
    authorizeRequest(request);
  }).toThrow(ForbiddenError);
});

it('refuses a read the api key has no permission for', () => {
  const { request } = setup({
    keyPermissions: [PermissionEnum.BILLING_READ],
    operationId: 'users.find',
  });

  expect(() => {
    authorizeRequest(request);
  }).toThrow(ForbiddenError);
});

it('reads the permission a route declares on its config', () => {
  const { request } = setup({
    role: UserRoleEnum.MODERATOR,
    permission: PermissionEnum.LEDGER_WRITE,
  });

  expect(() => {
    authorizeRequest(request);
  }).toThrow(ForbiddenError);
});

it('throws ForbiddenError when no permission can be resolved for the route', () => {
  const { request } = setup({ role: UserRoleEnum.ADMIN });

  expect(() => {
    authorizeRequest(request);
  }).toThrow(ForbiddenError);
});

it('throws ForbiddenError when the request carries neither an actor nor an api key', () => {
  const { request } = setup({ operationId: 'customers.find' });

  expect(() => {
    authorizeRequest(request);
  }).toThrow(ForbiddenError);
});
