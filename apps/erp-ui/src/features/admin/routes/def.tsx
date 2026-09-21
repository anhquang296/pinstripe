import AccountSettingsPage from '@features/admin/views/pages/AccountSettingsPage';
import RolesPage from '@features/admin/views/pages/RolesPage';
import SecuritySettingsPage from '@features/admin/views/pages/SecuritySettingsPage';
import UsersPage from '@features/admin/views/pages/UsersPage';
import { Navigate, type RouteObject } from 'react-router-dom';

import { adminPaths } from './paths';

export const adminRouteDefs: RouteObject[] = [
  {
    path: adminPaths.SETTINGS,
    element: <Navigate to={adminPaths.SETTINGS_ACCOUNT} replace />,
  },
  { path: adminPaths.SETTINGS_ACCOUNT, element: <AccountSettingsPage /> },
  { path: adminPaths.SETTINGS_SECURITY, element: <SecuritySettingsPage /> },

  { path: adminPaths.USERS, element: <UsersPage /> },
  { path: adminPaths.USER, element: <UsersPage /> },
  { path: adminPaths.ROLES, element: <RolesPage /> },
];
