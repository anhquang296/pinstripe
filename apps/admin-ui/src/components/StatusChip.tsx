import { Chip } from '@heroui/react';
import { includes } from 'lodash-es';

interface StatusChipProps {
  status: string;
}

const SUCCESS_STATUSES = ['active', 'paid', 'succeeded', 'complete', 'completed', 'posted'];
const WARNING_STATUSES = ['past_due', 'review', 'pending', 'processing', 'trialing', 'incomplete'];
const DANGER_STATUSES = ['overdue', 'void', 'voided', 'failed', 'canceled', 'uncollectible'];

function resolveStatusColor(status: string): 'success' | 'warning' | 'danger' | 'accent' {
  if (includes(SUCCESS_STATUSES, status)) {
    return 'success';
  }

  if (includes(WARNING_STATUSES, status)) {
    return 'warning';
  }

  if (includes(DANGER_STATUSES, status)) {
    return 'danger';
  }

  return 'accent';
}

export default function StatusChip({ status }: StatusChipProps) {
  return (
    <Chip color={resolveStatusColor(status)} size="sm" variant="soft">
      {status}
    </Chip>
  );
}
