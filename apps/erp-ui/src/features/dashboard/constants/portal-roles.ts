import type { PortalRole } from '@vxrerp/billing/contracts';
import { PortalRoleEnum } from '@vxrerp/billing/contracts';

export const PORTAL_ROLE_LABELS: Record<PortalRole, string> = {
  [PortalRoleEnum.OWNER]: 'Chủ xe',
  [PortalRoleEnum.ACCOUNTANT]: 'Kế toán nhà xe',
};
