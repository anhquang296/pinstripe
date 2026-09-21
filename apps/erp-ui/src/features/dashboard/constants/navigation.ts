import type { Permission } from '@vxrerp/platform/contracts';
import { PermissionEnum } from '@vxrerp/platform/contracts';

export interface NavigationItem {
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

export const NAVIGATION_GROUPS: NavigationGroup[] = [
  {
    label: 'Tổng quan',
    items: [
      {
        to: '/',
        title: 'Tổng quan',
        description: 'Doanh thu và đối soát gần nhất',
        initials: 'TQ',
        permission: PermissionEnum.BILLING_READ,
      },
    ],
  },
  {
    label: 'Sales',
    items: [
      {
        to: '/customers',
        title: 'Customers',
        description: 'Khách hàng và thông tin thanh toán',
        initials: 'CU',
        permission: PermissionEnum.BILLING_READ,
      },
      {
        to: '/catalog',
        title: 'Products & Prices',
        description: 'Danh mục sản phẩm và bảng giá',
        initials: 'PP',
        permission: PermissionEnum.BILLING_READ,
      },
      {
        to: '/subscriptions',
        title: 'Subscriptions',
        description: 'Thuê bao, lượng dùng, giảm giá, thuế',
        initials: 'SU',
        permission: PermissionEnum.BILLING_READ,
      },
      {
        to: '/checkout',
        title: 'Checkout & Portal',
        description: 'Payment link, phiên checkout, portal',
        initials: 'CK',
        permission: PermissionEnum.BILLING_READ,
      },
    ],
  },
  {
    label: 'Finance',
    items: [
      {
        to: '/invoices',
        title: 'Invoices',
        description: 'Hoá đơn và credit note',
        initials: 'IN',
        permission: PermissionEnum.BILLING_READ,
      },
      {
        to: '/payments',
        title: 'Payments',
        description: 'Payment intent và refund',
        initials: 'PA',
        permission: PermissionEnum.BILLING_READ,
      },
      {
        to: '/ledger',
        title: 'Ledger',
        description: 'Tài khoản và bút toán',
        initials: 'LE',
        permission: PermissionEnum.BILLING_READ,
      },
      {
        to: '/reports',
        title: 'Reports',
        description: 'Doanh thu và công nợ',
        initials: 'RE',
        permission: PermissionEnum.BILLING_READ,
      },
    ],
  },
  {
    label: 'Developers',
    items: [
      {
        to: '/webhooks',
        title: 'Webhooks',
        description: 'Endpoint và lần gửi',
        initials: 'WH',
        permission: PermissionEnum.INTEGRATION_WRITE,
      },
      {
        to: '/api-keys',
        title: 'API keys',
        description: 'Khoá của machine caller',
        initials: 'AK',
        permission: PermissionEnum.API_KEY_MANAGE,
      },
      {
        to: '/test-clocks',
        title: 'Test clocks',
        description: 'Tua thời gian để thử billing',
        initials: 'TC',
        permission: PermissionEnum.TEST_CLOCK_WRITE,
      },
    ],
  },
  {
    label: 'Admin',
    items: [
      {
        to: '/admin/users',
        title: 'Users',
        description: 'Người vận hành và vai trò',
        initials: 'US',
        permission: PermissionEnum.USER_MANAGE,
      },
      {
        to: '/admin/roles',
        title: 'Roles',
        description: 'Ma trận quyền theo vai trò',
        initials: 'RO',
        permission: PermissionEnum.USER_MANAGE,
      },
    ],
  },
];
