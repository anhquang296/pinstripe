import { dashboardRouteDefs } from '@features/dashboard';
import { createBrowserRouter, Outlet, RouterProvider } from 'react-router-dom';

import { AdminAuthProvider } from './AdminAuthProvider';

const router = createBrowserRouter([
  {
    element: (
      <AdminAuthProvider>
        <Outlet />
      </AdminAuthProvider>
    ),
    children: dashboardRouteDefs,
  },
]);

export function RoutesProvider() {
  return <RouterProvider router={router} />;
}
