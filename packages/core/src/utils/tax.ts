import type { TaxType } from '@contracts/taxes.types';
import type { Currency } from '@utils/currency';
import type { RoundingPolicy } from '@utils/money';
import { Money, RoundingPolicyEnum } from '@utils/money';
import _ from 'lodash';

const TAX_ROUNDING_POLICY: RoundingPolicy = RoundingPolicyEnum.HALF_UP;
const PERCENT_BASE = 100;

export interface TaxRateSnapshot {
  taxRateId: string;
  percentage: number;
  isInclusive: boolean;
  taxType: TaxType;
}

export interface LineTaxAmount extends TaxRateSnapshot {
  amount: number;
  taxableAmount: number;
}

export function buildLineTaxAmounts(
  taxableAmount: number,
  snapshots: readonly TaxRateSnapshot[],
  currency: Currency,
): LineTaxAmount[] {
  if (taxableAmount <= 0 || _.isEmpty(snapshots)) {
    return [];
  }

  const exclusiveAmounts = buildExclusiveAmounts(taxableAmount, snapshots, currency);
  const inclusiveAmounts = buildInclusiveAmounts(taxableAmount, snapshots, currency);

  return _(snapshots)
    .map((snapshot) => {
      const amounts = snapshot.isInclusive ? inclusiveAmounts : exclusiveAmounts;

      return _.get(amounts, snapshot.taxRateId, null);
    })
    .compact()
    .value();
}

function buildExclusiveAmounts(
  taxableAmount: number,
  snapshots: readonly TaxRateSnapshot[],
  currency: Currency,
): Record<string, LineTaxAmount> {
  const exclusiveSnapshots = _.reject(snapshots, 'isInclusive');

  const amounts = _.map(exclusiveSnapshots, (snapshot): LineTaxAmount => {
    const tax = Money.of(taxableAmount, currency).multiply(
      snapshot.percentage / PERCENT_BASE,
      TAX_ROUNDING_POLICY,
    );

    return { ...snapshot, amount: tax.amount, taxableAmount };
  });

  return _.keyBy(amounts, 'taxRateId');
}

function buildInclusiveAmounts(
  taxableAmount: number,
  snapshots: readonly TaxRateSnapshot[],
  currency: Currency,
): Record<string, LineTaxAmount> {
  const inclusiveSnapshots = _.filter(snapshots, 'isInclusive');
  const percentages = _.map(inclusiveSnapshots, 'percentage');
  const combinedPercentage = _.sum(percentages);

  if (combinedPercentage <= 0) {
    return {};
  }

  const combinedTax = Money.of(taxableAmount, currency).multiply(
    combinedPercentage / (PERCENT_BASE + combinedPercentage),
    TAX_ROUNDING_POLICY,
  );
  const shares = combinedTax.allocate(percentages);

  const amounts = _.map(inclusiveSnapshots, (snapshot, index): LineTaxAmount => {
    const amount = _.get(shares, [index, 'amount'], 0);

    return { ...snapshot, amount, taxableAmount };
  });

  return _.keyBy(amounts, 'taxRateId');
}
