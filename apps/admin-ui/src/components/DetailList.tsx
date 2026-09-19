import { map } from 'lodash-es';
import type { ReactNode } from 'react';

interface DetailListItem {
  label: string;
  value: ReactNode;
}

interface DetailListProps {
  items: DetailListItem[];
}

export default function DetailList({ items }: DetailListProps) {
  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {map(items, (item) => {
        return (
          <div key={item.label} className="flex flex-col gap-0.5">
            <dt className="text-[11px] font-semibold text-muted uppercase">{item.label}</dt>
            <dd className="text-[13px]">{item.value}</dd>
          </div>
        );
      })}
    </dl>
  );
}
