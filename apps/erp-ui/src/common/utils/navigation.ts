import type { NavigationGroup, NavigationItem } from '@common/constants/navigation';
import { NAVIGATION_GROUP_LABELS, NavigationGroupEnum } from '@common/constants/navigation';
import { filter, isEmpty, map, reject, some } from 'lodash-es';
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

export function matchesReportRange(reportRangePatterns: string[], pathname: string): boolean {
  return some(reportRangePatterns, (reportRangePattern) => {
    return matchPath(reportRangePattern, pathname) !== null;
  });
}
