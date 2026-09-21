import { adminPaths } from '@features/admin/routes/paths';

export const WEBHOOK_TABS = [
  { to: adminPaths.WEBHOOKS_ENDPOINTS, label: 'Endpoints' },
  { to: adminPaths.WEBHOOKS_DELIVERIES, label: 'Deliveries' },
];
