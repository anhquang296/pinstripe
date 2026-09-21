import type { Permission } from '@vxrerp/platform/contracts';

export enum NavigationGroupEnum {
  OVERVIEW = 'overview',
  SALES = 'sales',
  FINANCE = 'finance',
  DEVELOPERS = 'developers',
  ADMIN = 'admin',
}

export const NAVIGATION_GROUP_LABELS: Record<NavigationGroupEnum, string> = {
  [NavigationGroupEnum.OVERVIEW]: 'Tổng quan',
  [NavigationGroupEnum.SALES]: 'Sales',
  [NavigationGroupEnum.FINANCE]: 'Finance',
  [NavigationGroupEnum.DEVELOPERS]: 'Developers',
  [NavigationGroupEnum.ADMIN]: 'Admin',
};

export interface NavigationItem {
  group: NavigationGroupEnum;
  to: string;
  title: string;
  description: string;
  initials: string;
  permission: Permission;
}

export interface NavigationGroup {
  label: string;
  items: NavigationItem[];
}
