import { shellRouteDefs } from '@shell/routes/def';
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
    children: shellRouteDefs,
  },
]);

export function RoutesProvider() {
  return <RouterProvider router={router} />;
}
