import { Card } from '@heroui/react';
import type { ReactNode } from 'react';

interface StatItemProps {
  label: string;
  value: ReactNode;
  meta?: ReactNode;
}

export default function StatItem({ label, value, meta }: StatItemProps) {
  return (
    <Card>
      <Card.Header>
        <Card.Description className="text-xs font-medium uppercase">{label}</Card.Description>
      </Card.Header>
      <Card.Content className="gap-1">
        <span className="text-2xl font-semibold text-foreground tabular-nums">{value}</span>
        {meta ? <span className="text-xs text-muted">{meta}</span> : null}
      </Card.Content>
    </Card>
  );
}
