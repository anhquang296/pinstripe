import AppSidebar from '@features/dashboard/components/AppSidebar';
import AppTopbar from '@features/dashboard/components/AppTopbar';
import { Outlet } from 'react-router-dom';

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <AppTopbar />

      <main className="pt-topbar pl-sidebar">
        <div className="p-3">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
