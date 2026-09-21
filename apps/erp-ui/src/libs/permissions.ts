import type { Permission } from '@vxrerp/core/contracts';
import { useAccountQuery } from '@vxrerp/sdk/react';
import { get, includes } from 'lodash-es';

export function usePermissions(): Permission[] {
  const { data: account } = useAccountQuery();

  return get(account, 'permissions', []);
}

export function useCan(permission: Permission): boolean {
  const permissions = usePermissions();

  return includes(permissions, permission);
}
