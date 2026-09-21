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
    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {map(items, (item) => {
        return (
          <div key={item.label} className="flex flex-col gap-1">
            <dt className="text-xs font-medium text-muted uppercase">{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        );
      })}
    </dl>
  );
}
