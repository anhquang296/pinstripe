import { Card } from '@heroui/react';
import type { ReactNode } from 'react';

interface PageCardProps {
  title: ReactNode;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
}

export default function PageCard({ title, description, actions, children }: PageCardProps) {
  return (
    <section className="flex flex-col gap-4">
      <Card>
        <Card.Header className="flex-row items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-lg font-semibold text-foreground">{title}</h1>
            {description ? <Card.Description>{description}</Card.Description> : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </Card.Header>
      </Card>

      {children}
    </section>
  );
}
