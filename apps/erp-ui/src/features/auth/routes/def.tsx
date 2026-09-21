import RequireSession from '@features/auth/components/RequireSession';
import { FEATURE_ROUTES } from '@features/auth/features';
import AppLayout from '@features/auth/views/layouts/AppLayout';
import AuthPage from '@features/auth/views/pages/AuthPage';
import type { RouteObject } from 'react-router-dom';

import { authPaths } from './paths';

export const authRouteDefs: RouteObject[] = [
  { path: authPaths.AUTH, element: <AuthPage /> },
  {
    element: <RequireSession />,
    children: [{ element: <AppLayout />, children: FEATURE_ROUTES }],
  },
];
