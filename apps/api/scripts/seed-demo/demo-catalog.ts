import type { MeterAggregation, TaxIdType } from '@vxrerp/billing/contracts';
import {
  BillingSchemeEnum,
  CurrencyEnum,
  MeterAggregationEnum,
  RecurringIntervalEnum,
  TaxBehaviorEnum,
  TaxIdTypeEnum,
  TiersModeEnum,
  UsageTypeEnum,
} from '@vxrerp/billing/contracts';

export const DEMO_CURRENCY = CurrencyEnum.VND;
export const DEMO_COUNTRY = 'VN';
export const DEMO_TAX_ID_TYPE: TaxIdType = TaxIdTypeEnum.VN_TIN;

export const TICKET_EVENT_NAME = 'ticket.sold';
export const ZNS_EVENT_NAME = 'zns.sent';

export enum DemoMeterKeyEnum {
  TICKET = 'ticket',
  ZNS = 'zns',
}
export type DemoMeterKey = `${DemoMeterKeyEnum}`;

export enum DemoPriceKeyEnum {
  BOOKING_PLATFORM = 'booking_platform',
  BOOKING_TICKET = 'booking_ticket',
  BMS_VEHICLE = 'bms_vehicle',
  ZNS_MESSAGE = 'zns_message',
}
export type DemoPriceKey = `${DemoPriceKeyEnum}`;

export enum DemoProductKeyEnum {
  BOOKING = 'booking',
  BMS = 'bms',
  ZNS = 'zns',
}
export type DemoProductKey = `${DemoProductKeyEnum}`;

export interface DemoMeter {
  key: DemoMeterKey;
  displayName: string;
  eventName: string;
  aggregation: MeterAggregation;
  valueKey: string;
}

export const DEMO_METERS: readonly DemoMeter[] = [
  {
    key: DemoMeterKeyEnum.TICKET,
    displayName: 'Vé bán qua nền tảng',
    eventName: TICKET_EVENT_NAME,
    aggregation: MeterAggregationEnum.SUM,
    valueKey: 'quantity',
  },
  {
    key: DemoMeterKeyEnum.ZNS,
    displayName: 'Tin ZNS đã gửi',
    eventName: ZNS_EVENT_NAME,
    aggregation: MeterAggregationEnum.SUM,
    valueKey: 'quantity',
  },
];

export interface DemoProduct {
  key: DemoProductKey;
  name: string;
  description: string;
  unitLabel: string;
}

export const DEMO_PRODUCTS: readonly DemoProduct[] = [
  {
    key: DemoProductKeyEnum.BOOKING,
    name: 'Nền tảng bán vé Vexere',
    description: 'Kênh bán vé trực tuyến, quản lý chỗ và thanh toán cho nhà xe.',
    unitLabel: 'nhà xe',
  },
  {
    key: DemoProductKeyEnum.BMS,
    name: 'Phần mềm quản lý nhà xe (BMS)',
    description: 'Điều hành chuyến, quản lý xe, tài xế và lệnh vận chuyển.',
    unitLabel: 'xe',
  },
  {
    key: DemoProductKeyEnum.ZNS,
    name: 'Chăm sóc khách hàng ZNS',
    description: 'Gửi xác nhận vé và nhắc giờ khởi hành qua Zalo ZNS.',
    unitLabel: 'tin nhắn',
  },
];

export interface DemoPrice {
  key: DemoPriceKey;
  productKey: DemoProductKey;
  meterKey?: DemoMeterKey;
  lookupKey: string;
  nickname: string;
  billingScheme: BillingSchemeEnum;
  usageType: UsageTypeEnum;
  unitAmount?: number;
  tiers?: { upTo: number | null; unitAmount: number }[];
}

export const DEMO_PRICES: readonly DemoPrice[] = [
  {
    key: DemoPriceKeyEnum.BOOKING_PLATFORM,
    productKey: DemoProductKeyEnum.BOOKING,
    lookupKey: 'booking_platform_monthly',
    nickname: 'Phí nền tảng theo tháng',
    billingScheme: BillingSchemeEnum.PER_UNIT,
    usageType: UsageTypeEnum.LICENSED,
    unitAmount: 2_000_000,
  },
  {
    key: DemoPriceKeyEnum.BOOKING_TICKET,
    productKey: DemoProductKeyEnum.BOOKING,
    meterKey: DemoMeterKeyEnum.TICKET,
    lookupKey: 'booking_ticket_fee',
    nickname: 'Phí theo vé bán ra',
    billingScheme: BillingSchemeEnum.TIERED,
    usageType: UsageTypeEnum.METERED,
    tiers: [
      { upTo: 10_000, unitAmount: 2_000 },
      { upTo: null, unitAmount: 1_500 },
    ],
  },
  {
    key: DemoPriceKeyEnum.BMS_VEHICLE,
    productKey: DemoProductKeyEnum.BMS,
    lookupKey: 'bms_vehicle_monthly',
    nickname: 'Phí quản lý theo đầu xe',
    billingScheme: BillingSchemeEnum.PER_UNIT,
    usageType: UsageTypeEnum.LICENSED,
    unitAmount: 150_000,
  },
  {
    key: DemoPriceKeyEnum.ZNS_MESSAGE,
    productKey: DemoProductKeyEnum.ZNS,
    meterKey: DemoMeterKeyEnum.ZNS,
    lookupKey: 'zns_message_fee',
    nickname: 'Phí theo tin ZNS',
    billingScheme: BillingSchemeEnum.PER_UNIT,
    usageType: UsageTypeEnum.METERED,
    unitAmount: 350,
  },
];

export const DEMO_RECURRING = {
  interval: RecurringIntervalEnum.MONTH,
  intervalCount: 1,
} as const;

export const DEMO_TAX_BEHAVIOR = TaxBehaviorEnum.EXCLUSIVE;
export const DEMO_TIERS_MODE = TiersModeEnum.GRADUATED;

export const DEMO_TAX_RATE = {
  displayName: 'VAT 10%',
  description: 'Thuế giá trị gia tăng áp cho dịch vụ phần mềm',
  percentage: 10,
  inclusive: false,
  jurisdiction: 'Việt Nam',
  country: DEMO_COUNTRY,
} as const;

export const DEMO_COUPON = {
  name: 'Ưu đãi nhà xe mới',
  percentOff: 20,
  durationInMonths: 3,
} as const;

export const DEMO_PROMOTION_CODE = 'NHAXEMOI';

export const DEMO_CARD_TOKEN = 'tok_visa_ok';
