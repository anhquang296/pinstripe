import CrmOverviewPage from '@features/crm/views/pages/CrmOverviewPage';
import type { RouteObject } from 'react-router-dom';

import { crmPaths } from './paths';

export const crmRouteDefs: RouteObject[] = [
  { path: crmPaths.OVERVIEW, element: <CrmOverviewPage /> },
];
