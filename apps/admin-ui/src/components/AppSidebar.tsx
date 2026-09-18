import type { NavigationItem } from '@constants/navigation';
import { NAVIGATION_GROUPS } from '@constants/navigation';
import { cn } from '@lib/cn';
import { usePermissions } from '@lib/permissions';
import { filter, includes, isEmpty, map } from 'lodash-es';
import { NavLink } from 'react-router-dom';

export default function AppSidebar() {
  const permissions = usePermissions();

  const visibleGroups = filter(NAVIGATION_GROUPS, (navigationGroup) => {
    return !isEmpty(
      filter(navigationGroup.items, (navigationItem: NavigationItem) => {
        return includes(permissions, navigationItem.permission);
      }),
    );
  });

  return (
    <aside className="border-app-border-soft fixed inset-y-0 left-0 z-20 flex w-sidebar flex-col border-r bg-surface">
      <div className="border-app-border-soft flex h-11 items-center gap-2 border-b px-4">
        <span className="flex size-5 items-center justify-center rounded-sm bg-accent text-[10px] font-semibold text-accent-foreground">
          PS
        </span>
        <span className="text-[13px] font-semibold">Pinstripe</span>
      </div>

      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto py-3">
        {map(visibleGroups, (navigationGroup) => {
          return (
            <div key={navigationGroup.label} className="flex flex-col gap-1">
              <span className="text-app-description px-4 text-[11px] font-semibold uppercase">
                {navigationGroup.label}
              </span>

              {map(navigationGroup.items, (navigationItem) => {
                if (!includes(permissions, navigationItem.permission)) {
                  return null;
                }

                return (
                  <NavLink
                    key={navigationItem.to}
                    to={navigationItem.to}
                    className={({ isActive }) => {
                      return cn(
                        'flex items-start gap-2 border-l-2 border-transparent px-4 py-2',
                        isActive ? 'border-l-accent bg-accent-soft text-accent' : 'text-foreground',
                      );
                    }}
                  >
                    <span className="mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-xs bg-background text-[9px] font-semibold">
                      {navigationItem.initials}
                    </span>
                    <span className="flex flex-col">
                      <span className="text-[13px] leading-5 font-medium">
                        {navigationItem.title}
                      </span>
                      <span className="text-app-description text-[12px] leading-4">
                        {navigationItem.description}
                      </span>
                    </span>
                  </NavLink>
                );
              })}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
