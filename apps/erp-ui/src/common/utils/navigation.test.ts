import type { NavigationItem } from '@common/constants/navigation';
import { NavigationGroupEnum } from '@common/constants/navigation';
import { PermissionEnum } from '@vxrerp/platform/contracts';
import { find, map } from 'lodash-es';
import { expect, it } from 'vitest';

import { buildNavigationGroups, matchesReportRange } from './navigation';

function makeNavigationItem(overrides: Partial<NavigationItem> = {}): NavigationItem {
  return {
    group: NavigationGroupEnum.SALES,
    to: '/customers',
    title: 'Customers',
    description: 'Khách hàng',
    initials: 'CU',
    permission: PermissionEnum.BILLING_READ,
    ...overrides,
  };
}

it('orders the groups by NavigationGroupEnum, not by the order the items arrive in', () => {
  const navigationItems = [
    makeNavigationItem({ group: NavigationGroupEnum.ADMIN, title: 'Users' }),
    makeNavigationItem({ group: NavigationGroupEnum.OVERVIEW, title: 'Tổng quan' }),
  ];

  const result = buildNavigationGroups(navigationItems);

  expect(map(result, 'label')).toEqual(['Tổng quan', 'Admin']);
});

it('keeps the items of one group in the order the features contributed them', () => {
  const navigationItems = [
    makeNavigationItem({ group: NavigationGroupEnum.DEVELOPERS, title: 'Webhooks' }),
    makeNavigationItem({ group: NavigationGroupEnum.DEVELOPERS, title: 'API keys' }),
    makeNavigationItem({ group: NavigationGroupEnum.DEVELOPERS, title: 'Test clocks' }),
  ];

  const result = buildNavigationGroups(navigationItems);

  expect(map(find(result, { label: 'Developers' })?.items, 'title')).toEqual([
    'Webhooks',
    'API keys',
    'Test clocks',
  ]);
});

it('drops a group no feature contributes to', () => {
  const result = buildNavigationGroups([makeNavigationItem()]);

  expect(map(result, 'label')).toEqual(['Sales']);
});

it.each([
  { pathname: '/billing', expected: true },
  { pathname: '/billing/reports', expected: true },
  { pathname: '/billing/subscriptions/usage', expected: true },
  { pathname: '/billing/subscriptions/usage/mtr_123', expected: true },
  { pathname: '/billing/customers', expected: false },
  { pathname: '/billing/reports/x', expected: false },
])('matches the report range on $pathname: $expected', ({ pathname, expected }) => {
  const reportRangePatterns = ['/billing', '/billing/reports', '/billing/subscriptions/usage/*'];

  expect(matchesReportRange(reportRangePatterns, pathname)).toBe(expected);
});
