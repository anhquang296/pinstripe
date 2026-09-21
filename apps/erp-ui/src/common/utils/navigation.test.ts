import type { NavigationItem } from '@common/constants/navigation';
import { NavigationGroupEnum } from '@common/constants/navigation';
import { PermissionEnum } from '@vxrerp/platform/contracts';
import { find, map } from 'lodash-es';
import { expect, it } from 'vitest';

import {
  buildNavigationGroups,
  findActiveNavigationItem,
  findVisibleNavigationItems,
  matchesReportRange,
} from './navigation';

function makeNavigationItem(overrides: Partial<NavigationItem> = {}): NavigationItem {
  return {
    group: NavigationGroupEnum.SALES,
    to: '/billing/customers',
    title: 'Customers',
    description: 'Khách hàng',
    initials: 'CU',
    permission: PermissionEnum.BILLING_READ,
    ...overrides,
  };
}

it('orders the groups by NavigationGroupEnum, not by the order the items arrive in', () => {
  const navigationItems = [
    makeNavigationItem({ group: NavigationGroupEnum.ACCESS, title: 'Users' }),
    makeNavigationItem({ group: NavigationGroupEnum.OVERVIEW, title: 'Tổng quan' }),
  ];

  const result = buildNavigationGroups(navigationItems);

  expect(map(result, 'label')).toEqual(['Tổng quan', 'Người dùng & quyền']);
});

it('keeps the items of one group in the order the feature declares them', () => {
  const navigationItems = [
    makeNavigationItem({ group: NavigationGroupEnum.DEVELOPERS, title: 'Webhooks' }),
    makeNavigationItem({ group: NavigationGroupEnum.DEVELOPERS, title: 'API keys' }),
  ];

  const result = buildNavigationGroups(navigationItems);

  expect(map(find(result, { label: 'Developers' })?.items, 'title')).toEqual([
    'Webhooks',
    'API keys',
  ]);
});

it('drops a group the feature does not contribute to', () => {
  const result = buildNavigationGroups([makeNavigationItem()]);

  expect(map(result, 'label')).toEqual(['Sales']);
});

it('keeps an item without a permission and an item whose permission the user holds', () => {
  const navigationItems = [
    makeNavigationItem({ title: 'Account', permission: null }),
    makeNavigationItem({ title: 'Customers', permission: PermissionEnum.BILLING_READ }),
    makeNavigationItem({ title: 'Users', permission: PermissionEnum.USER_MANAGE }),
  ];

  const result = findVisibleNavigationItems(navigationItems, [PermissionEnum.BILLING_READ]);

  expect(map(result, 'title')).toEqual(['Account', 'Customers']);
});

it.each([
  { pathname: '/billing', expected: 'Tổng quan' },
  { pathname: '/billing/customers', expected: 'Customers' },
  { pathname: '/billing/customers/cus_123', expected: 'Customers' },
  { pathname: '/billing/customers-archive', expected: 'Tổng quan' },
])('resolves $pathname to the item $expected', ({ pathname, expected }) => {
  const navigationItems = [
    makeNavigationItem({ to: '/billing', title: 'Tổng quan' }),
    makeNavigationItem({ to: '/billing/customers', title: 'Customers' }),
  ];

  const result = findActiveNavigationItem(navigationItems, pathname);

  expect(result?.title).toBe(expected);
});

it('returns null when no item owns the pathname', () => {
  const result = findActiveNavigationItem([makeNavigationItem()], '/crm');

  expect(result).toBeNull();
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
