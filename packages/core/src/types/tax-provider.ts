import type { TaxBehavior } from '@contracts/prices.types';
import type { TaxExempt } from '@contracts/taxes.types';
import type { Currency } from '@utils/currency';
import type { LineTaxAmount } from '@utils/tax';

export interface TaxCalculationLine {
  reference: string;
  taxableAmount: number;
  taxBehavior: TaxBehavior;
  taxRateIds: string[];
}

export interface TaxCalculationDraft {
  livemode: boolean;
  currency: Currency;
  country: string | null;
  state: string | null;
  taxExempt: TaxExempt;
  isAutomatic: boolean;
  lines: TaxCalculationLine[];
}

export interface TaxCalculationLineAmounts {
  reference: string;
  taxAmounts: LineTaxAmount[];
}

export interface TaxProvider {
  calculate(draft: TaxCalculationDraft): Promise<TaxCalculationLineAmounts[]>;
}
