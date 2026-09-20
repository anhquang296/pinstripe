import { PORTAL_ROLE_LABELS } from '@features/portal/constants/labels';
import { Button, Label, ListBox, Select } from '@heroui/react';
import type { PortalIdentityResponse } from '@pinstripe/sdk';
import { compact, join, map, size, toString } from 'lodash-es';

interface PortalTopbarProps {
  account: PortalIdentityResponse;
  isSigningOut: boolean;
  isSwitching: boolean;
  onCustomerChange: (customerId: string) => void;
  onSignOut: () => void;
}

export default function PortalTopbar({
  account,
  isSigningOut,
  isSwitching,
  onCustomerChange,
  onSignOut,
}: PortalTopbarProps) {
  const { role, userEmail } = account;

  const roleLabel = role ? PORTAL_ROLE_LABELS[role] : null;
  const viewerLabel = join(compact([userEmail, roleLabel]), ' · ');

  return (
    <header className="fixed inset-x-0 top-0 left-sidebar z-10 flex h-topbar items-center justify-between gap-4 border-b border-separator bg-surface px-6">
      {size(account.memberships) > 1 ? (
        <Select
          className="w-72"
          aria-label="Chọn nhà xe"
          selectedKey={account.customerId}
          isDisabled={isSwitching}
          onSelectionChange={(key) => {
            onCustomerChange(toString(key));
          }}
        >
          <Label className="sr-only">Nhà xe</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {map(account.memberships, (membership) => {
                return (
                  <ListBox.Item key={membership.customerId} id={membership.customerId}>
                    {membership.customerName}
                  </ListBox.Item>
                );
              })}
            </ListBox>
          </Select.Popover>
        </Select>
      ) : (
        <span className="font-semibold">{account.name}</span>
      )}

      <div className="flex items-center gap-4">
        {viewerLabel ? <span className="text-xs text-muted">{viewerLabel}</span> : null}
        <Button
          variant="ghost"
          isPending={isSigningOut}
          onPress={() => {
            onSignOut();
          }}
        >
          Đăng xuất
        </Button>
      </div>
    </header>
  );
}
