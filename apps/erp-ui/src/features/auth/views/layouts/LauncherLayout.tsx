import AppTopbar from '@features/auth/components/AppTopbar';
import { Outlet } from 'react-router-dom';

export default function LauncherLayout() {
  return (
    <div className="min-h-screen bg-background">
      <AppTopbar feature={null} />

      <main className="pt-topbar">
        <Outlet />
      </main>
    </div>
  );
}
