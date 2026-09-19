'use client';

import PortalSidebar from '@features/portal/components/PortalSidebar';
import PortalTopbar from '@features/portal/components/PortalTopbar';
import RequirePortalSession from '@features/portal/components/RequirePortalSession';
import {
  useDeletePortalSessionMutation,
  useUpdatePortalSessionMutation,
} from '@pinstripe/sdk/react/portal';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

interface PortalLayoutProps {
  children: ReactNode;
}

export default function PortalLayout({ children }: PortalLayoutProps) {
  const router = useRouter();
  const { mutate: deletePortalSession, isPending: isSigningOut } = useDeletePortalSessionMutation();
  const { mutate: updatePortalSession, isPending: isSwitching } = useUpdatePortalSessionMutation({
    successMessage: 'Đã chuyển nhà xe.',
  });

  const handleOnSignOut = () => {
    deletePortalSession(undefined, {
      onSuccess: () => {
        router.replace('/login');
      },
    });
  };

  const handleOnCustomerChange = (customerId: string) => {
    updatePortalSession(
      { customerId },
      {
        onSuccess: () => {
          router.replace('/');
        },
      },
    );
  };

  return (
    <RequirePortalSession>
      {(account) => {
        return (
          <div className="min-h-screen">
            <PortalSidebar />
            <PortalTopbar
              account={account}
              isSigningOut={isSigningOut}
              isSwitching={isSwitching}
              onCustomerChange={handleOnCustomerChange}
              onSignOut={handleOnSignOut}
            />
            <main className="ml-sidebar px-6 pt-[calc(var(--app-topbar-height)+24px)] pb-10">
              {children}
            </main>
          </div>
        );
      }}
    </RequirePortalSession>
  );
}
