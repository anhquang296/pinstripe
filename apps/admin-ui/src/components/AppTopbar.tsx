import { UserButton } from '@better-auth-ui/heroui';
import { NAVIGATION_GROUPS } from '@constants/navigation';
import { find, flatMap, get, startsWith } from 'lodash-es';
import { useLocation } from 'react-router-dom';

export default function AppTopbar() {
  const { pathname } = useLocation();

  const navigationEntries = flatMap(NAVIGATION_GROUPS, (navigationGroup) => {
    return flatMap(navigationGroup.items, (navigationItem) => {
      return [{ group: navigationGroup.label, item: navigationItem }];
    });
  });

  const activeEntry = find(navigationEntries, (navigationEntry) => {
    return startsWith(pathname, navigationEntry.item.to);
  });

  const groupLabel = get(activeEntry, 'group', 'Pinstripe');
  const itemTitle = get(activeEntry, 'item.title', 'Tổng quan');

  return (
    <header className="border-app-border-soft fixed inset-x-0 top-0 left-sidebar z-10 flex h-topbar items-center justify-between border-b bg-surface px-4">
      <span className="text-[13px] text-accent">
        {groupLabel} / {itemTitle}
      </span>

      <UserButton size="icon" />
    </header>
  );
}
