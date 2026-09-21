import type { FeatureDefinition } from '@common/types/feature-definition';
import AppSidebar from '@features/auth/components/AppSidebar';
import AppTopbar from '@features/auth/components/AppTopbar';
import { Outlet } from 'react-router-dom';

interface FeatureLayoutProps {
  feature: FeatureDefinition;
}

export default function FeatureLayout({ feature }: FeatureLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar feature={feature} />
      <AppTopbar feature={feature} />

      <main className="pt-topbar pl-sidebar">
        <div className="p-3">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
