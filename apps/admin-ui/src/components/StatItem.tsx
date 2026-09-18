import type { ReactNode } from 'react';

interface StatItemProps {
  label: string;
  value: ReactNode;
  meta?: ReactNode;
}

export default function StatItem({ label, value, meta }: StatItemProps) {
  return (
    <div className="border-app-border-soft flex flex-col gap-1 rounded-md border bg-surface p-4">
      <span className="text-app-description text-[11px] font-semibold uppercase">{label}</span>
      <span className="text-[20px] leading-7 font-bold">{value}</span>
      {meta ? <span className="text-app-label text-[12px]">{meta}</span> : null}
    </div>
  );
}
