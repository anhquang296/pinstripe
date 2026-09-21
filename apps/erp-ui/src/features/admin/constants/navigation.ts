import type { NavigationItem } from '@common/constants/navigation';
import { NavigationGroupEnum } from '@common/constants/navigation';
import { adminPaths } from '@features/admin/routes/paths';
import { PermissionEnum } from '@vxrerp/platform/contracts';

export const ADMIN_NAVIGATION_ITEMS: NavigationItem[] = [
  {
    group: NavigationGroupEnum.ACCOUNT,
    to: adminPaths.SETTINGS_ACCOUNT,
    title: 'Hồ sơ',
    description: 'Tên và ảnh đại diện',
    initials: 'HS',
    permission: null,
  },
  {
    group: NavigationGroupEnum.ACCOUNT,
    to: adminPaths.SETTINGS_SECURITY,
    title: 'Bảo mật',
    description: 'Mật khẩu và phiên đăng nhập',
    initials: 'BM',
    permission: null,
  },
  {
    group: NavigationGroupEnum.ACCESS,
    to: adminPaths.USERS,
    title: 'Users',
    description: 'Người vận hành và vai trò',
    initials: 'US',
    permission: PermissionEnum.USER_MANAGE,
  },
  {
    group: NavigationGroupEnum.ACCESS,
    to: adminPaths.ROLES,
    title: 'Roles',
    description: 'Ma trận quyền theo vai trò',
    initials: 'RO',
    permission: PermissionEnum.USER_MANAGE,
  },
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
];
