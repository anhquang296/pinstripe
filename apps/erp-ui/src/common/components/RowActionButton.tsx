import { Button, Tooltip } from '@heroui/react';
import type { ReactNode } from 'react';

interface RowActionButtonProps {
  label: string;
  icon: ReactNode;
  isDanger?: boolean;
  isDisabled?: boolean;
  onPress: () => void;
}

export default function RowActionButton({
  label,
  icon,
  isDanger = false,
  isDisabled = false,
  onPress,
}: RowActionButtonProps) {
  return (
    <Tooltip delay={300}>
      <Button
        isIconOnly
        size="sm"
        variant={isDanger ? 'danger-soft' : 'tertiary'}
        aria-label={label}
        isDisabled={isDisabled}
        onPress={onPress}
      >
        {icon}
      </Button>
      <Tooltip.Content>{label}</Tooltip.Content>
    </Tooltip>
  );
}
