import { Button } from '@heroui/react';
import type { PortalIdentityResponse } from '@pinstripe/sdk';

interface PortalTopbarProps {
  account: PortalIdentityResponse;
  isSigningOut: boolean;
  onSignOut: () => void;
}

export default function PortalTopbar({ account, isSigningOut, onSignOut }: PortalTopbarProps) {
  return (
    <header className="fixed inset-x-0 top-0 left-sidebar z-10 flex h-topbar items-center justify-between border-b border-separator bg-surface px-6">
      <div className="flex flex-col">
        <span className="font-semibold">{account.name}</span>
        {account.email ? <span className="text-xs text-muted">{account.email}</span> : null}
      </div>

      <Button
        variant="ghost"
        isPending={isSigningOut}
        onPress={() => {
          onSignOut();
        }}
      >
        Đăng xuất
      </Button>
    </header>
  );
}
