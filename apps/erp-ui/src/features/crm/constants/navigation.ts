import type { NavigationItem } from '@common/constants/navigation';
import { NavigationGroupEnum } from '@common/constants/navigation';
import { crmPaths } from '@features/crm/routes/paths';
import { PermissionEnum } from '@vxrerp/platform/contracts';

export const CRM_NAVIGATION_ITEMS: NavigationItem[] = [
  {
    group: NavigationGroupEnum.CRM,
    to: crmPaths.OVERVIEW,
    title: 'CRM',
    description: 'Nhà xe, liên hệ, deal',
    initials: 'CR',
    permission: PermissionEnum.CRM_READ,
  },
];
