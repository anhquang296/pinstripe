import type { PortalRole } from '@pinstripe/core/contracts';
import { PortalRoleEnum } from '@pinstripe/core/contracts';

export const PORTAL_ROLE_LABELS: Record<PortalRole, string> = {
  [PortalRoleEnum.OWNER]: 'Chủ xe',
  [PortalRoleEnum.ACCOUNTANT]: 'Kế toán nhà xe',
};
