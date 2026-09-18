import type { ReactNode } from 'react';

interface StatGridProps {
  children: ReactNode;
}

export default function StatGrid({ children }: StatGridProps) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{children}</div>;
}
