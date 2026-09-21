import type { NavigationItem } from '@common/constants/navigation';
import { NavigationGroupEnum } from '@common/constants/navigation';
import { crmPaths } from '@features/crm/routes/paths';
import { PermissionEnum } from '@vxrerp/platform/contracts';

export const CRM_NAVIGATION_ITEMS: NavigationItem[] = [
  {
    group: NavigationGroupEnum.OVERVIEW,
    to: crmPaths.OVERVIEW,
    title: 'Tổng quan',
    description: 'Nhà xe, liên hệ, deal',
    initials: 'TQ',
    permission: PermissionEnum.CRM_READ,
  },
  {
    group: NavigationGroupEnum.SETTINGS,
    to: crmPaths.SETTINGS,
    title: 'Cài đặt CRM',
    description: 'Pipeline, stage và nguồn khách',
    initials: 'CĐ',
    permission: PermissionEnum.CRM_READ,
  },
];
