import type { PriceResponse } from '@vxrerp/billing/contracts';
import { BillingSchemeEnum } from '@vxrerp/billing/contracts';
import { size, toUpper } from 'lodash-es';

export function formatPriceAmount(price: PriceResponse): string {
  if (price.billingScheme === BillingSchemeEnum.TIERED) {
    return `${size(price.tiers)} tier (${price.tiersMode})`;
  }

  const { unitAmount } = price;

  if (unitAmount === null) {
    return toUpper(price.currency);
  }

  return `${unitAmount.toLocaleString('vi-VN')} ${toUpper(price.currency)}`;
}
