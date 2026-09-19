import type { Permission } from '@pinstripe/core/contracts';
import { PermissionEnum } from '@pinstripe/core/contracts';

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
        to: '/products',
        title: 'Products',
        description: 'Danh mục sản phẩm',
        initials: 'PR',
        permission: PermissionEnum.BILLING_READ,
      },
      {
        to: '/prices',
        title: 'Prices',
        description: 'Bảng giá và bậc giá',
        initials: 'PC',
        permission: PermissionEnum.BILLING_READ,
      },
      {
        to: '/subscriptions',
        title: 'Subscriptions',
        description: 'Gói thuê bao đang chạy',
        initials: 'SU',
        permission: PermissionEnum.BILLING_READ,
      },
      {
        to: '/meters',
        title: 'Meters',
        description: 'Đo lượng dùng theo event',
        initials: 'ME',
        permission: PermissionEnum.BILLING_READ,
      },
      {
        to: '/rating',
        title: 'Rating',
        description: 'Dòng tính tiền theo lượng dùng',
        initials: 'RA',
        permission: PermissionEnum.BILLING_READ,
      },
      {
        to: '/discounts',
        title: 'Giảm giá',
        description: 'Coupon và promotion code',
        initials: 'GG',
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
        permission: PermissionEnum.LEDGER_WRITE,
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
        to: '/test-clocks',
        title: 'Test clocks',
        description: 'Tua thời gian để thử billing',
        initials: 'TC',
        permission: PermissionEnum.TEST_CLOCK_WRITE,
      },
    ],
  },
];
