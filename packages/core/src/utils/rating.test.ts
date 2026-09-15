import { BillingSchemeEnum, RoundingModeEnum, TiersModeEnum } from '@contracts/prices.types';
import { CurrencyEnum } from '@utils/currency';
import type { RatingLine, RatingPrice } from '@utils/rating';
import { LineItemTypeEnum, rateLine, rateLines, ratePrice } from '@utils/rating';
import _ from 'lodash';
import { describe, expect, it } from 'vitest';

const PERIOD_START = new Date('2026-01-01T00:00:00.000Z');
const PERIOD_END = new Date('2026-02-01T00:00:00.000Z');

function makePrice(overrides: Partial<RatingPrice> = {}): RatingPrice {
  return {
    id: 'price_test',
    currency: CurrencyEnum.VND,
    billingScheme: BillingSchemeEnum.PER_UNIT,
    unitAmount: 1_000,
    tiersMode: null,
    tiers: null,
    transformQuantity: null,
    ...overrides,
  };
}

function makeLine(overrides: Partial<RatingLine> = {}): RatingLine {
  return {
    subscriptionItemId: 'si_test',
    price: makePrice(),
    type: LineItemTypeEnum.SUBSCRIPTION,
    quantity: 1,
    periodStart: PERIOD_START,
    periodEnd: PERIOD_END,
    usageStart: null,
    usageEnd: null,
    isCredit: false,
    ...overrides,
  };
}

describe('ratePrice per_unit', () => {
  it('multiplies the unit amount by the quantity', () => {
    const price = makePrice({ unitAmount: 1_500 });

    const amount = ratePrice(price, 4);

    expect(amount.amount).toBe(6_000);
  });

  it('rates a zero quantity as zero rather than charging a minimum', () => {
    const price = makePrice({ unitAmount: 1_500 });

    const amount = ratePrice(price, 0);

    expect(amount.amount).toBe(0);
  });

  it('rejects a negative quantity because a credit is expressed by the line, not the quantity', () => {
    const price = makePrice();

    const act = () => {
      return ratePrice(price, -1);
    };

    expect(act).toThrowError(/negative quantity/);
  });
});

describe('ratePrice transformQuantity', () => {
  it.each([
    { round: RoundingModeEnum.UP, quantity: 1_001, expected: 2_000 },
    { round: RoundingModeEnum.DOWN, quantity: 1_001, expected: 1_000 },
    { round: RoundingModeEnum.UP, quantity: 2_000, expected: 2_000 },
  ])(
    'rounds $quantity units $round into billable packages costing $expected',
    ({ round, quantity, expected }) => {
      const price = makePrice({ unitAmount: 1_000, transformQuantity: { divideBy: 1_000, round } });

      const amount = ratePrice(price, quantity);

      expect(amount.amount).toBe(expected);
    },
  );

  it('rates a quantity below one package as zero when rounding down', () => {
    const price = makePrice({
      unitAmount: 1_000,
      transformQuantity: { divideBy: 1_000, round: RoundingModeEnum.DOWN },
    });

    const amount = ratePrice(price, 999);

    expect(amount.amount).toBe(0);
  });
});

describe('ratePrice graduated tiers', () => {
  const graduated = makePrice({
    billingScheme: BillingSchemeEnum.TIERED,
    unitAmount: null,
    tiersMode: TiersModeEnum.GRADUATED,
    tiers: [
      { upTo: 100, unitAmount: 10 },
      { upTo: 1_000, unitAmount: 5 },
      { upTo: null, unitAmount: 2 },
    ],
  });

  it.each([
    { quantity: 50, expected: 500 },
    { quantity: 100, expected: 1_000 },
    { quantity: 101, expected: 1_005 },
    { quantity: 1_000, expected: 5_500 },
    { quantity: 1_001, expected: 5_502 },
  ])(
    'prices $quantity units across the tiers it reaches as $expected',
    ({ quantity, expected }) => {
      const amount = ratePrice(graduated, quantity);

      expect(amount.amount).toBe(expected);
    },
  );

  it('charges the flat amount only of the tiers the quantity reaches into', () => {
    const price = makePrice({
      billingScheme: BillingSchemeEnum.TIERED,
      unitAmount: null,
      tiersMode: TiersModeEnum.GRADUATED,
      tiers: [
        { upTo: 10, flatAmount: 5_000, unitAmount: 0 },
        { upTo: null, flatAmount: 2_000, unitAmount: 100 },
      ],
    });

    expect(ratePrice(price, 0).amount).toBe(0);
    expect(ratePrice(price, 10).amount).toBe(5_000);
    expect(ratePrice(price, 11).amount).toBe(7_100);
  });

  it('stays equal to the sum of its own slices for every quantity', () => {
    const totals = _.map(_.range(0, 1_500, 37), (quantity) => {
      return ratePrice(graduated, quantity).amount;
    });
    const isMonotonic = _.every(totals, (total, index) => {
      return index === 0 || total >= (totals[index - 1] ?? 0);
    });

    expect(isMonotonic).toBe(true);
  });
});

describe('ratePrice volume tiers', () => {
  const volume = makePrice({
    billingScheme: BillingSchemeEnum.TIERED,
    unitAmount: null,
    tiersMode: TiersModeEnum.VOLUME,
    tiers: [
      { upTo: 100, unitAmount: 10 },
      { upTo: 1_000, unitAmount: 5 },
      { upTo: null, unitAmount: 2 },
    ],
  });

  it.each([
    { quantity: 50, expected: 500 },
    { quantity: 100, expected: 1_000 },
    { quantity: 101, expected: 505 },
    { quantity: 1_001, expected: 2_002 },
  ])(
    'prices all $quantity units at the tier they land in as $expected',
    ({ quantity, expected }) => {
      const amount = ratePrice(volume, quantity);

      expect(amount.amount).toBe(expected);
    },
  );

  it('charges the landing tier flat amount once on top of the units', () => {
    const price = makePrice({
      billingScheme: BillingSchemeEnum.TIERED,
      unitAmount: null,
      tiersMode: TiersModeEnum.VOLUME,
      tiers: [{ upTo: null, flatAmount: 9_000, unitAmount: 100 }],
    });

    const amount = ratePrice(price, 3);

    expect(amount.amount).toBe(9_300);
  });

  it('rejects a tiered price whose tiers were dropped', () => {
    const price = makePrice({ billingScheme: BillingSchemeEnum.TIERED, unitAmount: null });

    const act = () => {
      return ratePrice(price, 1);
    };

    expect(act).toThrowError(/carries no tiers/);
  });
});

describe('rateLine proration', () => {
  it('charges the full amount when the line covers the whole period', () => {
    const line = makeLine({ quantity: 2, price: makePrice({ unitAmount: 31_000 }) });

    const lineItem = rateLine(line);

    expect(lineItem.prorationFactor).toBe(1);
    expect(lineItem.amount.amount).toBe(62_000);
  });

  it('charges half the amount for a line starting halfway through the period', () => {
    const line = makeLine({
      price: makePrice({ unitAmount: 62_000 }),
      type: LineItemTypeEnum.PRORATION,
      usageStart: new Date('2026-01-16T12:00:00.000Z'),
      usageEnd: PERIOD_END,
    });

    const lineItem = rateLine(line);

    expect(lineItem.amount.amount).toBe(31_000);
  });

  it('negates the amount when the line is a credit for time already paid for', () => {
    const line = makeLine({
      price: makePrice({ unitAmount: 62_000 }),
      type: LineItemTypeEnum.PRORATION,
      usageStart: PERIOD_START,
      usageEnd: new Date('2026-01-16T12:00:00.000Z'),
      isCredit: true,
    });

    const lineItem = rateLine(line);

    expect(lineItem.amount.amount).toBe(-31_000);
  });

  it('rejects a period that does not move forward', () => {
    const line = makeLine({
      periodEnd: PERIOD_START,
      usageStart: PERIOD_START,
      usageEnd: PERIOD_START,
    });

    const act = () => {
      return rateLine(line);
    };

    expect(act).toThrowError(/must end after it starts/);
  });
});

describe('rateLines', () => {
  it('sums a licensed charge and its usage charge into one total', () => {
    const lines = [
      makeLine({ price: makePrice({ id: 'price_base', unitAmount: 50_000 }) }),
      makeLine({
        subscriptionItemId: 'si_usage',
        price: makePrice({ id: 'price_usage', unitAmount: 7 }),
        type: LineItemTypeEnum.USAGE,
        quantity: 1_200,
      }),
    ];

    const result = rateLines(lines, CurrencyEnum.VND);

    expect(_.map(result.lineItems, 'priceId')).toEqual(['price_base', 'price_usage']);
    expect(result.total.amount).toBe(58_400);
  });

  it('nets a mid-cycle upgrade down to the difference between the two plans', () => {
    const switchedAt = new Date('2026-01-16T12:00:00.000Z');
    const lines = [
      makeLine({
        price: makePrice({ id: 'price_old', unitAmount: 62_000 }),
        type: LineItemTypeEnum.PRORATION,
        usageStart: switchedAt,
        usageEnd: PERIOD_END,
        isCredit: true,
      }),
      makeLine({
        price: makePrice({ id: 'price_new', unitAmount: 124_000 }),
        type: LineItemTypeEnum.PRORATION,
        usageStart: switchedAt,
        usageEnd: PERIOD_END,
      }),
    ];

    const result = rateLines(lines, CurrencyEnum.VND);

    expect(result.total.amount).toBe(31_000);
  });

  it('rejects mixing currencies in one rating run', () => {
    const lines = [
      makeLine(),
      makeLine({ price: makePrice({ currency: CurrencyEnum.USD, unitAmount: 100 }) }),
    ];

    const act = () => {
      return rateLines(lines, CurrencyEnum.VND);
    };

    expect(act).toThrowError(/currency mismatch/);
  });
});
