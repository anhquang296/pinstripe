import { ROLE_OPTIONS } from '@common/constants/roles';
import { Chip, ToggleButton, ToggleButtonGroup } from '@heroui/react';
import type { UserRole } from '@pinstripe/core/contracts';
import { find, map } from 'lodash-es';

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
    <ToggleButtonGroup
      size="sm"
      aria-label="Vai trò"
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[role]}
      onSelectionChange={(keys) => {
        const roleOption = find(ROLE_OPTIONS, (option) => {
          return keys.has(option.value);
        });

        if (roleOption) {
          onRoleChange(roleOption.value);
        }
      }}
    >
      {map(ROLE_OPTIONS, (roleOption) => {
        return (
          <ToggleButton key={roleOption.value} id={roleOption.value}>
            {roleOption.value}
          </ToggleButton>
        );
      })}
    </ToggleButtonGroup>
  );
}
