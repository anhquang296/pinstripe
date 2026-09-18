import { TaxTypeEnum } from '@contracts/taxes.types';
import { CurrencyEnum } from '@utils/currency';
import type { TaxRateSnapshot } from '@utils/tax';
import { buildLineTaxAmounts } from '@utils/tax';
import _ from 'lodash';
import { describe, expect, it } from 'vitest';

function makeSnapshot(overrides: Partial<TaxRateSnapshot> = {}): TaxRateSnapshot {
  return {
    taxRateId: 'txr_default',
    percentage: 10,
    isInclusive: false,
    taxType: TaxTypeEnum.VAT,
    ...overrides,
  };
}

describe('buildLineTaxAmounts', () => {
  it('adds the tax on top of the line when the rate is exclusive', () => {
    const snapshots = [makeSnapshot({ taxRateId: 'txr_usd', percentage: 8.5 })];

    const result = buildLineTaxAmounts(120_000, snapshots, CurrencyEnum.USD);

    expect(result).toEqual([
      {
        taxRateId: 'txr_usd',
        percentage: 8.5,
        isInclusive: false,
        taxType: TaxTypeEnum.VAT,
        amount: 10_200,
        taxableAmount: 120_000,
      },
    ]);
  });

  it('carves the tax out of the line when the rate is inclusive', () => {
    const snapshots = [makeSnapshot({ taxRateId: 'txr_vn', percentage: 10, isInclusive: true })];

    const result = buildLineTaxAmounts(1_100_000, snapshots, CurrencyEnum.VND);

    expect(_.get(result, '0.amount')).toBe(100_000);
  });

  it('rounds an inclusive carve out half up', () => {
    const snapshots = [makeSnapshot({ taxRateId: 'txr_vn', percentage: 10, isInclusive: true })];

    const result = buildLineTaxAmounts(1_000_005, snapshots, CurrencyEnum.VND);

    expect(_.get(result, '0.amount')).toBe(90_910);
  });

  it('allocates one combined inclusive carve out across two rates without losing a unit', () => {
    const snapshots = [
      makeSnapshot({ taxRateId: 'txr_first', percentage: 7, isInclusive: true }),
      makeSnapshot({ taxRateId: 'txr_second', percentage: 3, isInclusive: true }),
    ];

    const result = buildLineTaxAmounts(1_000_001, snapshots, CurrencyEnum.VND);
    const combined = buildLineTaxAmounts(
      1_000_001,
      [makeSnapshot({ taxRateId: 'txr_both', percentage: 10, isInclusive: true })],
      CurrencyEnum.VND,
    );

    expect(_.sumBy(result, 'amount')).toBe(_.get(combined, '0.amount'));
    expect(_.map(result, 'amount')).toEqual([63_636, 27_273]);
  });

  it('keeps an inclusive and an exclusive rate on the same line apart', () => {
    const snapshots = [
      makeSnapshot({ taxRateId: 'txr_inclusive', percentage: 10, isInclusive: true }),
      makeSnapshot({ taxRateId: 'txr_exclusive', percentage: 5 }),
    ];

    const result = buildLineTaxAmounts(1_100_000, snapshots, CurrencyEnum.VND);

    expect(_.map(result, 'amount')).toEqual([100_000, 55_000]);
  });

  it('returns nothing when no rate applies', () => {
    const result = buildLineTaxAmounts(500_000, [], CurrencyEnum.VND);

    expect(result).toEqual([]);
  });

  it('returns nothing when the line has been discounted to zero', () => {
    const result = buildLineTaxAmounts(0, [makeSnapshot()], CurrencyEnum.VND);

    expect(result).toEqual([]);
  });
});
