import { cn } from '@lib/cn';
import { map } from 'lodash-es';

interface DrawerTabsItem {
  key: string;
  label: string;
}

interface DrawerTabsProps {
  items: DrawerTabsItem[];
  activeKey: string;
  onSelect: (key: string) => void;
}

export default function DrawerTabs({ items, activeKey, onSelect }: DrawerTabsProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 pt-1">
      {map(items, (item) => {
        return (
          <button
            key={item.key}
            type="button"
            className={cn(
              'border-b-[3px] pb-1 text-[13px] font-medium',
              item.key === activeKey
                ? 'border-accent text-accent'
                : 'text-app-label border-transparent',
            )}
            onClick={() => {
              onSelect(item.key);
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
