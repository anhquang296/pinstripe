import { Card } from '@heroui/react';
import type { ReactNode } from 'react';

interface DrawerSectionProps {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}

export default function DrawerSection({ title, actions, children }: DrawerSectionProps) {
  return (
    <Card variant="secondary">
      <Card.Header className="flex-row items-center justify-between gap-3">
        <Card.Title>{title}</Card.Title>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </Card.Header>
      <Card.Content className="gap-3">{children}</Card.Content>
    </Card>
  );
}
