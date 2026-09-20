export interface NavigationItem {
  to: string;
  title: string;
}

export const NAVIGATION_ITEMS: readonly NavigationItem[] = [
  { to: '/', title: 'Tổng quan' },
  { to: '/invoices', title: 'Hóa đơn' },
  { to: '/payments', title: 'Thanh toán' },
  { to: '/subscriptions', title: 'Gói dịch vụ' },
  { to: '/usage', title: 'Mức sử dụng' },
  { to: '/account', title: 'Tài khoản' },
];
