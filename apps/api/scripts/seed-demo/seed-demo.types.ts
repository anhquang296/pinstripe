import type { DemoMeterKey, DemoPriceKey, DemoProductKey } from './demo-catalog';
import type { DemoOperator } from './demo-operators';

export interface SeededCatalog {
  productIdByKey: Record<DemoProductKey, string>;
  priceIdByKey: Record<DemoPriceKey, string>;
  meterIdByKey: Record<DemoMeterKey, string>;
  taxRateId: string;
}

export interface SeededOperator {
  operator: DemoOperator;
  customerId: string;
  subscriptionId: string | null;
}

export interface BackdatedInvoice {
  invoiceId: string;
  shiftDays: number;
  periodStart: string;
  periodEnd: string;
}
