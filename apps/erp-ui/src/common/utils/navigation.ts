import type { NavigationGroup, NavigationItem } from '@common/constants/navigation';
import { NAVIGATION_GROUP_LABELS, NavigationGroupEnum } from '@common/constants/navigation';
import { filter, isEmpty, map, reject, some, startsWith } from 'lodash-es';

const ROOT_PATH = '/';

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

export function matchesReportRange(reportRangePaths: string[], pathname: string): boolean {
  return some(reportRangePaths, (reportRangePath) => {
    if (pathname === reportRangePath) {
      return true;
    }

    return reportRangePath !== ROOT_PATH && startsWith(pathname, `${reportRangePath}/`);
  });
}
