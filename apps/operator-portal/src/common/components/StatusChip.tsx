import { Chip } from '@heroui/react';

interface StatusChipProps {
  label: string;
  tone: 'success' | 'warning' | 'danger' | 'default';
}

export default function StatusChip({ label, tone }: StatusChipProps) {
  return (
    <Chip color={tone} size="sm" variant="soft" className="whitespace-nowrap">
      {label}
    </Chip>
  );
}
