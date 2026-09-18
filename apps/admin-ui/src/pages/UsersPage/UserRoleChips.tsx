import { ROLE_OPTIONS } from '@constants/roles';
import { Chip } from '@heroui/react';
import { cn } from '@lib/cn';
import type { UserRole } from '@pinstripe/core/contracts';
import { map } from 'lodash-es';

interface UserRoleChipsProps {
  role: string;
  isDisabled?: boolean;
  onRoleChange: (role: UserRole) => void;
}

export default function UserRoleChips({ role, isDisabled, onRoleChange }: UserRoleChipsProps) {
  if (isDisabled) {
    return (
      <Chip size="sm" variant="soft">
        {role}
      </Chip>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {map(ROLE_OPTIONS, (roleOption) => {
        return (
          <button
            key={roleOption.value}
            type="button"
            className={cn(
              'rounded-xs px-2 py-0.5 text-[11px] font-medium',
              roleOption.value === role
                ? 'bg-accent-soft text-accent'
                : 'text-app-label bg-background',
            )}
            onClick={() => {
              onRoleChange(roleOption.value);
            }}
          >
            {roleOption.value}
          </button>
        );
      })}
    </div>
  );
}
