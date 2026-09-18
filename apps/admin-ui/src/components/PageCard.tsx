import type { ReactNode } from 'react';

interface PageCardProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  tabs?: ReactNode;
  children: ReactNode;
}

export default function PageCard({ title, description, actions, tabs, children }: PageCardProps) {
  return (
    <section className="rounded-md bg-surface">
      <div className="flex items-start justify-between gap-4 px-4 pt-4 pb-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-[18px] leading-[26px] font-bold text-accent">{title}</h1>
          {description ? <p className="text-app-description text-[13px]">{description}</p> : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>

      {tabs ? <div className="border-app-border-soft border-b">{tabs}</div> : null}

      <div className="flex flex-col gap-6 bg-background p-4">{children}</div>
    </section>
  );
}
