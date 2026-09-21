import AccountSettingsPage from '@features/admin/views/pages/AccountSettingsPage';
import ApiKeysPage from '@features/admin/views/pages/ApiKeysPage';
import RolesPage from '@features/admin/views/pages/RolesPage';
import SecuritySettingsPage from '@features/admin/views/pages/SecuritySettingsPage';
import UsersPage from '@features/admin/views/pages/UsersPage';
import WebhookDeliveriesPage from '@features/admin/views/pages/WebhookDeliveriesPage';
import WebhookEndpointsPage from '@features/admin/views/pages/WebhookEndpointsPage';
import { Navigate, type RouteObject } from 'react-router-dom';

import { adminPaths } from './paths';

export const adminRouteDefs: RouteObject[] = [
  {
    path: adminPaths.SETTINGS,
    element: <Navigate to={adminPaths.SETTINGS_ACCOUNT} replace />,
  },
  { path: adminPaths.SETTINGS_ACCOUNT, element: <AccountSettingsPage /> },
  { path: adminPaths.SETTINGS_SECURITY, element: <SecuritySettingsPage /> },

  {
    path: adminPaths.WEBHOOKS,
    element: <Navigate to={adminPaths.WEBHOOKS_ENDPOINTS} replace />,
  },
  { path: adminPaths.WEBHOOKS_ENDPOINTS, element: <WebhookEndpointsPage /> },
  { path: adminPaths.WEBHOOKS_ENDPOINT, element: <WebhookEndpointsPage /> },
  { path: adminPaths.WEBHOOKS_DELIVERIES, element: <WebhookDeliveriesPage /> },

  { path: adminPaths.API_KEYS, element: <ApiKeysPage /> },

  { path: adminPaths.USERS, element: <UsersPage /> },
  { path: adminPaths.USER, element: <UsersPage /> },
  { path: adminPaths.ROLES, element: <RolesPage /> },
];
