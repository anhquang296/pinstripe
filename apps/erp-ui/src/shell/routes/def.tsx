import RequireSession from '@shell/components/RequireSession';
import { FEATURE_ROUTES } from '@shell/features';
import AppLayout from '@shell/views/layouts/AppLayout';
import AuthPage from '@shell/views/pages/AuthPage';
import type { RouteObject } from 'react-router-dom';

import { shellPaths } from './paths';

export const shellRouteDefs: RouteObject[] = [
  { path: shellPaths.AUTH, element: <AuthPage /> },
  {
    element: <RequireSession />,
    children: [{ element: <AppLayout />, children: FEATURE_ROUTES }],
  },
];
