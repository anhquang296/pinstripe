import type { CollectionMethod, PortalRole } from '@pinstripe/core/contracts';
import { CollectionMethodEnum, PortalRoleEnum } from '@pinstripe/core/contracts';

import type { DemoPriceKey } from './demo-catalog';
import { DemoPriceKeyEnum } from './demo-catalog';

export enum DemoOperatorKeyEnum {
  FUTA = 'futa',
  THANH_BUOI = 'thanh_buoi',
  HOANG_LONG = 'hoang_long',
  KUMHO = 'kumho',
  SAO_VIET = 'sao_viet',
}
export type DemoOperatorKey = `${DemoOperatorKeyEnum}`;

export interface DemoSubscriptionItem {
  priceKey: DemoPriceKey;
  quantity: number;
}

export interface DemoPortalUser {
  email: string;
  name: string;
  role: PortalRole;
}

export interface DemoInvoiceLine {
  description: string;
  quantity: number;
  unitAmount: number;
}

export interface DemoOperator {
  key: DemoOperatorKey;
  name: string;
  email: string;
  phone: string;
  taxId: string;
  addressLine1: string;
  city: string;
  partnerAccountId: string;
  collectionMethod: CollectionMethod;
  trialPeriodDays?: number;
  items: readonly DemoSubscriptionItem[];
  portalUsers: readonly DemoPortalUser[];
  ticketsPerMonth: number;
  znsPerMonth: number;
  monthlyLines: readonly DemoInvoiceLine[];
}

export const DEMO_OPERATORS: readonly DemoOperator[] = [
  {
    key: DemoOperatorKeyEnum.FUTA,
    name: 'Công ty CP Xe khách Phương Trang FUTA Bus Lines',
    email: 'ketoan@futabus.vn',
    phone: '02838386852',
    taxId: '0304782387',
    addressLine1: '80 Trần Hưng Đạo, Phường Phạm Ngũ Lão, Quận 1',
    city: 'TP. Hồ Chí Minh',
    partnerAccountId: 'futa-hcm',
    collectionMethod: CollectionMethodEnum.OFFSET_TICKET,
    items: [
      { priceKey: DemoPriceKeyEnum.BOOKING_PLATFORM, quantity: 1 },
      { priceKey: DemoPriceKeyEnum.BMS_VEHICLE, quantity: 180 },
      { priceKey: DemoPriceKeyEnum.BOOKING_TICKET, quantity: 1 },
      { priceKey: DemoPriceKeyEnum.ZNS_MESSAGE, quantity: 1 },
    ],
    portalUsers: [
      { email: 'giamdoc@futabus.vn', name: 'Nguyễn Hữu Luận', role: PortalRoleEnum.OWNER },
      { email: 'ketoan@futabus.vn', name: 'Trần Thị Bích Ngọc', role: PortalRoleEnum.ACCOUNTANT },
    ],
    ticketsPerMonth: 12_400,
    znsPerMonth: 38_500,
    monthlyLines: [
      { description: 'Nền tảng bán vé Vexere — phí nền tảng', quantity: 1, unitAmount: 2_000_000 },
      { description: 'Phần mềm quản lý nhà xe (BMS) — 180 xe', quantity: 180, unitAmount: 150_000 },
      { description: 'Phí theo vé bán ra — 10.000 vé đầu', quantity: 10_000, unitAmount: 2_000 },
      { description: 'Phí theo vé bán ra — 2.400 vé vượt bậc', quantity: 2_400, unitAmount: 1_500 },
      { description: 'Chăm sóc khách hàng ZNS — 38.500 tin', quantity: 38_500, unitAmount: 350 },
    ],
  },
  {
    key: DemoOperatorKeyEnum.THANH_BUOI,
    name: 'Công ty TNHH Thành Bưởi',
    email: 'ketoan@thanhbuoi.com.vn',
    phone: '02838306306',
    taxId: '0302467291',
    addressLine1: '266 Lê Hồng Phong, Phường 4, Quận 5',
    city: 'TP. Hồ Chí Minh',
    partnerAccountId: 'thanhbuoi-hcm',
    collectionMethod: CollectionMethodEnum.DEBIT_WALLET,
    items: [
      { priceKey: DemoPriceKeyEnum.BOOKING_PLATFORM, quantity: 1 },
      { priceKey: DemoPriceKeyEnum.BMS_VEHICLE, quantity: 60 },
      { priceKey: DemoPriceKeyEnum.BOOKING_TICKET, quantity: 1 },
    ],
    portalUsers: [
      { email: 'chuxe@thanhbuoi.com.vn', name: 'Lê Đức Thành', role: PortalRoleEnum.OWNER },
      { email: 'ketoan@thanhbuoi.com.vn', name: 'Phạm Thu Hà', role: PortalRoleEnum.ACCOUNTANT },
    ],
    ticketsPerMonth: 4_150,
    znsPerMonth: 0,
    monthlyLines: [
      { description: 'Nền tảng bán vé Vexere — phí nền tảng', quantity: 1, unitAmount: 2_000_000 },
      { description: 'Phần mềm quản lý nhà xe (BMS) — 60 xe', quantity: 60, unitAmount: 150_000 },
      { description: 'Phí theo vé bán ra — 4.150 vé', quantity: 4_150, unitAmount: 2_000 },
    ],
  },
  {
    key: DemoOperatorKeyEnum.HOANG_LONG,
    name: 'Công ty TNHH Hoàng Long',
    email: 'ketoan@hoanglongasia.vn',
    phone: '02439877225',
    taxId: '0200571862',
    addressLine1: '28 Trần Nhật Duật, Phường Đồng Xuân, Quận Hoàn Kiếm',
    city: 'Hà Nội',
    partnerAccountId: 'hoanglong-hn',
    collectionMethod: CollectionMethodEnum.SEND_INVOICE,
    items: [
      { priceKey: DemoPriceKeyEnum.BOOKING_PLATFORM, quantity: 1 },
      { priceKey: DemoPriceKeyEnum.BOOKING_TICKET, quantity: 1 },
      { priceKey: DemoPriceKeyEnum.ZNS_MESSAGE, quantity: 1 },
    ],
    portalUsers: [
      { email: 'chuxe@hoanglongasia.vn', name: 'Vũ Hoàng Long', role: PortalRoleEnum.OWNER },
      { email: 'ketoan@hoanglongasia.vn', name: 'Đỗ Minh Châu', role: PortalRoleEnum.ACCOUNTANT },
    ],
    ticketsPerMonth: 2_680,
    znsPerMonth: 7_900,
    monthlyLines: [
      { description: 'Nền tảng bán vé Vexere — phí nền tảng', quantity: 1, unitAmount: 2_000_000 },
      { description: 'Phí theo vé bán ra — 2.680 vé', quantity: 2_680, unitAmount: 2_000 },
      { description: 'Chăm sóc khách hàng ZNS — 7.900 tin', quantity: 7_900, unitAmount: 350 },
    ],
  },
  {
    key: DemoOperatorKeyEnum.KUMHO,
    name: 'Công ty TNHH Kumho Samco Buslines',
    email: 'ketoan@kumhosamco.com.vn',
    phone: '02835112112',
    taxId: '0305234118',
    addressLine1: '292 Đinh Bộ Lĩnh, Phường 26, Quận Bình Thạnh',
    city: 'TP. Hồ Chí Minh',
    partnerAccountId: 'kumho-hcm',
    collectionMethod: CollectionMethodEnum.CHARGE_AUTOMATICALLY,
    items: [{ priceKey: DemoPriceKeyEnum.BMS_VEHICLE, quantity: 45 }],
    portalUsers: [
      { email: 'chuxe@kumhosamco.com.vn', name: 'Park Jin Ho', role: PortalRoleEnum.OWNER },
      { email: 'ketoan@kumhosamco.com.vn', name: 'Ngô Thanh Tú', role: PortalRoleEnum.ACCOUNTANT },
    ],
    ticketsPerMonth: 0,
    znsPerMonth: 0,
    monthlyLines: [
      { description: 'Phần mềm quản lý nhà xe (BMS) — 45 xe', quantity: 45, unitAmount: 150_000 },
    ],
  },
  {
    key: DemoOperatorKeyEnum.SAO_VIET,
    name: 'Công ty TNHH Vận tải Sao Việt',
    email: 'ketoan@saovietlimousine.vn',
    phone: '02143888888',
    taxId: '5300485217',
    addressLine1: '789 Điện Biên Phủ, Phường Sa Pa',
    city: 'Lào Cai',
    partnerAccountId: 'saoviet-hn',
    collectionMethod: CollectionMethodEnum.SEND_INVOICE,
    trialPeriodDays: 14,
    items: [{ priceKey: DemoPriceKeyEnum.BOOKING_PLATFORM, quantity: 1 }],
    portalUsers: [
      { email: 'chuxe@saovietlimousine.vn', name: 'Hoàng Văn Sao', role: PortalRoleEnum.OWNER },
      {
        email: 'ketoan@saovietlimousine.vn',
        name: 'Nguyễn Thị Lan',
        role: PortalRoleEnum.ACCOUNTANT,
      },
    ],
    ticketsPerMonth: 0,
    znsPerMonth: 0,
    monthlyLines: [],
  },
];
