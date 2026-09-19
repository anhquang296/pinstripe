import { cn } from '@lib/cn';
import { map } from 'lodash-es';
import { NavLink } from 'react-router-dom';

interface PageTabsItem {
  to: string;
  label: string;
}

interface PageTabsProps {
  items: PageTabsItem[];
}

export default function PageTabs({ items }: PageTabsProps) {
  return (
    <nav className="flex items-center gap-5 px-4">
      {map(items, (item) => {
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => {
              return cn(
                'border-b-[3px] pt-1 pb-2 text-[14px] font-medium',
                isActive ? 'border-accent text-accent' : 'text-app-label border-transparent',
              );
            }}
          >
            {item.label}
          </NavLink>
        );
      })}
    </nav>
  );
}
