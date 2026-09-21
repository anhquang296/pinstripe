import RequireSession from '@features/auth/components/RequireSession';
import { ERP_FEATURES } from '@features/auth/features';
import FeatureLayout from '@features/auth/views/layouts/FeatureLayout';
import LauncherLayout from '@features/auth/views/layouts/LauncherLayout';
import AppLauncherPage from '@features/auth/views/pages/AppLauncherPage';
import AuthPage from '@features/auth/views/pages/AuthPage';
import { map } from 'lodash-es';
import type { RouteObject } from 'react-router-dom';

import { authPaths } from './paths';

const featureRouteDefs: RouteObject[] = map(ERP_FEATURES, (feature) => {
  return { element: <FeatureLayout feature={feature} />, children: feature.routes };
});

export const authRouteDefs: RouteObject[] = [
  { path: authPaths.AUTH, element: <AuthPage /> },
  {
    element: <RequireSession />,
    children: [
      {
        element: <LauncherLayout />,
        children: [{ path: authPaths.LAUNCHER, element: <AppLauncherPage /> }],
      },
      ...featureRouteDefs,
    ],
  },
];
