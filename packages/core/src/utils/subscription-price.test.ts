import { PriceTypeEnum, RecurringIntervalEnum } from '@contracts/prices.types';
import type { Price } from '@database/schemas';
import { BadRequestError } from '@errors/app.error';
import { CurrencyEnum } from '@utils/currency';
import { assertPricesUsable, resolveInterval } from '@utils/subscription-price';
import { describe, expect, it } from 'vitest';

function makePrice(overrides: Partial<Price> = {}): Price {
  return {
    id: 'price_test',
    currency: CurrencyEnum.VND,
    type: PriceTypeEnum.RECURRING,
    active: true,
    recurringInterval: RecurringIntervalEnum.MONTH,
    recurringIntervalCount: 1,
    ...overrides,
  } as Price;
}

describe('resolveInterval', () => {
  it('reads the billing period off the first recurring price', () => {
    const result = resolveInterval([makePrice()]);

    expect(result).toEqual({ interval: RecurringIntervalEnum.MONTH, intervalCount: 1 });
  });

  it('throws BadRequestError when no price carries a recurring interval', () => {
    const act = () => {
      return resolveInterval([
        makePrice({ recurringInterval: null, recurringIntervalCount: null }),
      ]);
    };

    expect(act).toThrowError(BadRequestError);
  });
});

describe('assertPricesUsable', () => {
  it('accepts recurring prices that share a currency and a billing period', () => {
    const act = () => {
      return assertPricesUsable(
        [makePrice({ id: 'price_one' }), makePrice({ id: 'price_two' })],
        CurrencyEnum.VND,
      );
    };

    expect(act).not.toThrowError();
  });

  it('throws BadRequestError when a price is archived', () => {
    const act = () => {
      return assertPricesUsable([makePrice({ active: false })], CurrencyEnum.VND);
    };

    expect(act).toThrowError(BadRequestError);
  });

  it('throws BadRequestError when a price is one time', () => {
    const act = () => {
      return assertPricesUsable([makePrice({ type: PriceTypeEnum.ONE_TIME })], CurrencyEnum.VND);
    };

    expect(act).toThrowError(BadRequestError);
  });

  it('throws BadRequestError when a price bills in another currency', () => {
    const act = () => {
      return assertPricesUsable([makePrice({ currency: CurrencyEnum.USD })], CurrencyEnum.VND);
    };

    expect(act).toThrowError(BadRequestError);
  });

  it('throws BadRequestError when two prices disagree on the billing period', () => {
    const act = () => {
      return assertPricesUsable(
        [
          makePrice(),
          makePrice({ id: 'price_two', recurringInterval: RecurringIntervalEnum.YEAR }),
        ],
        CurrencyEnum.VND,
      );
    };

    expect(act).toThrowError(BadRequestError);
  });

  it('throws BadRequestError when the subscription carries no price at all', () => {
    const act = () => {
      return assertPricesUsable([], CurrencyEnum.VND);
    };

    expect(act).toThrowError(BadRequestError);
  });
});
