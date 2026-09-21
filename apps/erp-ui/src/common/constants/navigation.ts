import type { Permission } from '@vxrerp/platform/contracts';

export enum NavigationGroupEnum {
  OVERVIEW = 'overview',
  SALES = 'sales',
  FINANCE = 'finance',
  ACCOUNT = 'account',
  ACCESS = 'access',
  DEVELOPERS = 'developers',
  SETTINGS = 'settings',
}

export const NAVIGATION_GROUP_LABELS: Record<NavigationGroupEnum, string> = {
  [NavigationGroupEnum.OVERVIEW]: 'Tổng quan',
  [NavigationGroupEnum.SALES]: 'Sales',
  [NavigationGroupEnum.FINANCE]: 'Finance',
  [NavigationGroupEnum.ACCOUNT]: 'Tài khoản',
  [NavigationGroupEnum.ACCESS]: 'Người dùng & quyền',
  [NavigationGroupEnum.DEVELOPERS]: 'Developers',
  [NavigationGroupEnum.SETTINGS]: 'Cài đặt',
};

export interface NavigationItem {
  group: NavigationGroupEnum;
  to: string;
  title: string;
  description: string;
  initials: string;
  permission: Permission | null;
}

export interface NavigationGroup {
  label: string;
  items: NavigationItem[];
}
