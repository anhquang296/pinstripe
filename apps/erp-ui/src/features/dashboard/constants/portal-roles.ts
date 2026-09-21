import type { PortalRole } from '@vxrerp/core/contracts';
import { PortalRoleEnum } from '@vxrerp/core/contracts';

export const PORTAL_ROLE_LABELS: Record<PortalRole, string> = {
  [PortalRoleEnum.OWNER]: 'Chủ xe',
  [PortalRoleEnum.ACCOUNTANT]: 'Kế toán nhà xe',
};
