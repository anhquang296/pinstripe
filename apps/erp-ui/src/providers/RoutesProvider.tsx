import { authRouteDefs } from '@features/auth/routes/def';
import { NuqsAdapter } from 'nuqs/adapters/react-router/v7';
import { createBrowserRouter, Outlet, RouterProvider } from 'react-router-dom';

import { AdminAuthProvider } from './AdminAuthProvider';

const router = createBrowserRouter([
  {
    element: (
      <NuqsAdapter>
        <AdminAuthProvider>
          <Outlet />
        </AdminAuthProvider>
      </NuqsAdapter>
    ),
    children: authRouteDefs,
  },
]);

export function RoutesProvider() {
  return <RouterProvider router={router} />;
}
