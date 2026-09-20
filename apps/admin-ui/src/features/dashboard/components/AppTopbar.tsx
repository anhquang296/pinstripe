import { UserButton } from '@better-auth-ui/heroui';
import ReportRangePicker from '@common/components/ReportRangePicker';
import { NAVIGATION_GROUPS } from '@features/dashboard/constants/navigation';
import { hasReportRange } from '@features/dashboard/constants/report-range';
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
    const { to } = navigationEntry.item;

    return pathname === to || startsWith(pathname, `${to}/`);
  });

  const groupLabel = get(activeEntry, 'group', 'Pinstripe');
  const itemTitle = get(activeEntry, 'item.title', 'Tổng quan');

  return (
    <header className="border-separator fixed inset-x-0 top-0 left-sidebar z-10 flex h-topbar items-center border-b bg-surface px-4">
      <span className="text-[13px] text-accent">
        {groupLabel} / {itemTitle}
      </span>

      <div className="ml-auto flex items-center gap-3">
        {hasReportRange(pathname) ? <ReportRangePicker /> : null}

        <UserButton size="icon" />
      </div>
    </header>
  );
}
