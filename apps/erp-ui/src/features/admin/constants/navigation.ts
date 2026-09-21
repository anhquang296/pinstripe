import type { NavigationItem } from '@common/constants/navigation';
import { NavigationGroupEnum } from '@common/constants/navigation';
import { adminPaths } from '@features/admin/routes/paths';
import { PermissionEnum } from '@vxrerp/platform/contracts';

export const ADMIN_NAVIGATION_ITEMS: NavigationItem[] = [
  {
    group: NavigationGroupEnum.DEVELOPERS,
    to: adminPaths.WEBHOOKS,
    title: 'Webhooks',
    description: 'Endpoint và lần gửi',
    initials: 'WH',
    permission: PermissionEnum.INTEGRATION_WRITE,
  },
  {
    group: NavigationGroupEnum.DEVELOPERS,
    to: adminPaths.API_KEYS,
    title: 'API keys',
    description: 'Khoá của machine caller',
    initials: 'AK',
    permission: PermissionEnum.API_KEY_MANAGE,
  },
  {
    group: NavigationGroupEnum.ADMIN,
    to: adminPaths.ADMIN_USERS,
    title: 'Users',
    description: 'Người vận hành và vai trò',
    initials: 'US',
    permission: PermissionEnum.USER_MANAGE,
  },
  {
    group: NavigationGroupEnum.ADMIN,
    to: adminPaths.ADMIN_ROLES,
    title: 'Roles',
    description: 'Ma trận quyền theo vai trò',
    initials: 'RO',
    permission: PermissionEnum.USER_MANAGE,
  },
];
