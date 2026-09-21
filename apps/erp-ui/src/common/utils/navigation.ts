import type { NavigationGroup, NavigationItem } from '@common/constants/navigation';
import { NAVIGATION_GROUP_LABELS, NavigationGroupEnum } from '@common/constants/navigation';
import type { Permission } from '@vxrerp/platform/contracts';
import { filter, includes, isEmpty, isNull, map, maxBy, reject, some, startsWith } from 'lodash-es';
import { matchPath } from 'react-router-dom';

export function buildNavigationGroups(navigationItems: NavigationItem[]): NavigationGroup[] {
  const navigationGroups = map(Object.values(NavigationGroupEnum), (group) => {
    return {
      label: NAVIGATION_GROUP_LABELS[group],
      items: filter(navigationItems, { group }),
    };
  });

  return reject(navigationGroups, (navigationGroup) => {
    return isEmpty(navigationGroup.items);
  });
}

export function findVisibleNavigationItems(
  navigationItems: NavigationItem[],
  permissions: Permission[],
): NavigationItem[] {
  return filter(navigationItems, ({ permission }) => {
    return isNull(permission) || includes(permissions, permission);
  });
}

export function findActiveNavigationItem(
  navigationItems: NavigationItem[],
  pathname: string,
): NavigationItem | null {
  const matchingItems = filter(navigationItems, ({ to }) => {
    return pathname === to || startsWith(pathname, `${to}/`);
  });

  const activeItem = maxBy(matchingItems, 'to.length');

  return activeItem ?? null;
}

export function matchesReportRange(reportRangePatterns: string[], pathname: string): boolean {
  return some(reportRangePatterns, (reportRangePattern) => {
    return matchPath(reportRangePattern, pathname) !== null;
  });
}
