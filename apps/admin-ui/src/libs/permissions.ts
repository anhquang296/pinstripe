import type { Permission } from '@pinstripe/core/contracts';
import { useAccountQuery } from '@pinstripe/sdk/react';
import { get, includes } from 'lodash-es';

export function usePermissions(): Permission[] {
  const { data: account } = useAccountQuery();

  return get(account, 'permissions', []);
}

export function useCan(permission: Permission): boolean {
  const permissions = usePermissions();

  return includes(permissions, permission);
}
