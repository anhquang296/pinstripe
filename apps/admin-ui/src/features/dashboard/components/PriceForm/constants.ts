import {
  BillingSchemeEnum,
  CurrencyEnum,
  PriceTypeEnum,
  RecurringIntervalEnum,
  TiersModeEnum,
  UsageTypeEnum,
} from '@pinstripe/core/contracts';
import { map, toUpper } from 'lodash-es';

export const CURRENCY_OPTIONS = map(CurrencyEnum, (currency) => {
  return { value: currency, label: toUpper(currency) };
});

export const PRICE_TYPE_OPTIONS = [
  { value: PriceTypeEnum.RECURRING, label: 'recurring — thu theo chu kỳ' },
  { value: PriceTypeEnum.ONE_TIME, label: 'one_time — thu một lần' },
];

export const INTERVAL_OPTIONS = [
  { value: RecurringIntervalEnum.DAY, label: 'day — ngày' },
  { value: RecurringIntervalEnum.WEEK, label: 'week — tuần' },
  { value: RecurringIntervalEnum.MONTH, label: 'month — tháng' },
  { value: RecurringIntervalEnum.YEAR, label: 'year — năm' },
];

export const USAGE_TYPE_OPTIONS = [
  { value: UsageTypeEnum.LICENSED, label: 'licensed — trả theo chỗ' },
  { value: UsageTypeEnum.METERED, label: 'metered — trả theo lượng dùng' },
];

export const BILLING_SCHEME_OPTIONS = [
  { value: BillingSchemeEnum.PER_UNIT, label: 'per_unit — một đơn giá' },
  { value: BillingSchemeEnum.TIERED, label: 'tiered — giá theo bậc' },
];

export const TIERS_MODE_OPTIONS = [
  { value: TiersModeEnum.GRADUATED, label: 'graduated — mỗi bậc tính giá của bậc đó' },
  { value: TiersModeEnum.VOLUME, label: 'volume — toàn bộ tính theo bậc đạt được' },
];
