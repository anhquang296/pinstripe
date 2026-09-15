import { describe, expect, it } from 'vitest';
import { CurrencyEnum } from '@utils/currency';
import { Money, RoundingPolicyEnum } from '@utils/money';

describe('Money.of', () => {
  it('rejects a fractional amount because minor units are always integers', () => {
    const amount = 10.5;

    const act = () => Money.of(amount, CurrencyEnum.USD);

    expect(act).toThrowError(/safe integer/);
  });
});

describe('Money.add', () => {
  it('rejects combining two different currencies', () => {
    const usd = Money.of(100, CurrencyEnum.USD);
    const vnd = Money.of(100, CurrencyEnum.VND);

    const act = () => usd.add(vnd);

    expect(act).toThrowError(/currency mismatch/);
  });
});

describe('Money.allocate', () => {
  it('distributes the remainder so the parts sum back to the original amount', () => {
    const total = Money.of(100, CurrencyEnum.USD);

    const shares = total.allocate([1, 1, 1]);

    expect(shares.map((share) => share.amount)).toEqual([34, 33, 33]);
  });

  it('keeps the sum exact for a negative amount such as a credit', () => {
    const credit = Money.of(-100, CurrencyEnum.USD);

    const shares = credit.allocate([1, 1, 1]);

    expect(shares.reduce((total, share) => total + share.amount, 0)).toBe(-100);
  });

  it('weights the split by the given ratios', () => {
    const total = Money.of(1000, CurrencyEnum.USD);

    const shares = total.allocate([7, 3]);

    expect(shares.map((share) => share.amount)).toEqual([700, 300]);
  });
});

describe('Money.multiply', () => {
  it('rounds a half up when the policy is half up', () => {
    const amount = Money.of(5, CurrencyEnum.USD);

    const result = amount.multiply(0.5, RoundingPolicyEnum.HALF_UP);

    expect(result.amount).toBe(3);
  });

  it('rounds a half to the even neighbour when the policy is half even', () => {
    const amount = Money.of(5, CurrencyEnum.USD);

    const result = amount.multiply(0.5, RoundingPolicyEnum.HALF_EVEN);

    expect(result.amount).toBe(2);
  });

  it('truncates toward zero for a negative amount when the policy is toward zero', () => {
    const amount = Money.of(-5, CurrencyEnum.USD);

    const result = amount.multiply(0.5, RoundingPolicyEnum.TOWARD_ZERO);

    expect(result.amount).toBe(-2);
  });
});

describe('Money.fromMajorUnit', () => {
  it('scales by the currency exponent for a two decimal currency', () => {
    const value = 12.34;

    const result = Money.fromMajorUnit(value, CurrencyEnum.USD, RoundingPolicyEnum.HALF_UP);

    expect(result.amount).toBe(1234);
  });

  it('keeps a zero decimal currency at its face value', () => {
    const value = 125000;

    const result = Money.fromMajorUnit(value, CurrencyEnum.VND, RoundingPolicyEnum.HALF_UP);

    expect(result.amount).toBe(125000);
  });
});
