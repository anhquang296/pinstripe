import type { ReactNode } from 'react';

interface DrawerSectionProps {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}

export default function DrawerSection({ title, actions, children }: DrawerSectionProps) {
  return (
    <section className="border-app-border-soft flex flex-col gap-3 rounded-md border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[14px] font-semibold">{title}</h2>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}
