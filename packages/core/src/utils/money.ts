import { BadRequestError } from '@errors/app.error';
import type { Currency } from '@utils/currency';
import { getCurrencyExponent } from '@utils/currency';
import _ from 'lodash';

export enum RoundingPolicyEnum {
  HALF_UP = 'half_up',
  HALF_EVEN = 'half_even',
  TOWARD_ZERO = 'toward_zero',
  AWAY_FROM_ZERO = 'away_from_zero',
}
export type RoundingPolicy = `${RoundingPolicyEnum}`;

export interface MoneyJson {
  amount: number;
  currency: Currency;
}

function roundToInteger(value: number, policy: RoundingPolicy): number {
  const sign = value < 0 ? -1 : 1;
  const magnitude = Math.abs(value);
  const floor = Math.floor(magnitude);
  const fraction = magnitude - floor;

  if (policy === RoundingPolicyEnum.TOWARD_ZERO) {
    return sign * floor;
  }

  if (policy === RoundingPolicyEnum.AWAY_FROM_ZERO) {
    return sign * Math.ceil(magnitude);
  }

  if (policy === RoundingPolicyEnum.HALF_EVEN && fraction === 0.5) {
    const isFloorEven = floor % 2 === 0;
    const evenMagnitude = isFloorEven ? floor : floor + 1;

    return sign * evenMagnitude;
  }

  const roundedMagnitude = fraction >= 0.5 ? floor + 1 : floor;

  return sign * roundedMagnitude;
}

export class Money {
  private constructor(
    readonly amount: number,
    readonly currency: Currency,
  ) {}

  static of(amount: number, currency: Currency): Money {
    if (Number.isSafeInteger(amount)) {
      return new Money(amount, currency);
    }

    throw new BadRequestError(`Money amount must be a safe integer in minor units, got ${amount}`);
  }

  static zero(currency: Currency): Money {
    return new Money(0, currency);
  }

  static fromMajorUnit(value: number, currency: Currency, policy: RoundingPolicy): Money {
    const factor = 10 ** getCurrencyExponent(currency);

    return Money.of(roundToInteger(value * factor, policy), currency);
  }

  static sum(amounts: readonly Money[], currency: Currency): Money {
    return _.reduce(
      amounts,
      (total, amount) => {
        return total.add(amount);
      },
      Money.zero(currency),
    );
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);

    return Money.of(this.amount + other.amount, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);

    return Money.of(this.amount - other.amount, this.currency);
  }

  multiply(factor: number, policy: RoundingPolicy): Money {
    return Money.of(roundToInteger(this.amount * factor, policy), this.currency);
  }

  negate(): Money {
    return Money.of(-this.amount, this.currency);
  }

  allocate(weights: readonly number[]): Money[] {
    const totalWeight = _.sum(weights);

    if (totalWeight <= 0) {
      throw new BadRequestError('Money allocation requires weights summing to more than zero');
    }

    if (this.isNegative()) {
      return _.map(this.negate().allocate(weights), (share) => {
        return share.negate();
      });
    }

    const shares = _.map(weights, (weight) => {
      return Math.floor((this.amount * weight) / totalWeight);
    });

    const distributed = _.sum(shares);

    const remainders = _.orderBy(
      _.map(weights, (weight, index) => {
        const share = _.get(shares, index, 0);

        return { index, remainder: (this.amount * weight) / totalWeight - share };
      }),
      'remainder',
      'desc',
    );

    let leftover = this.amount - distributed;
    let cursor = 0;

    while (leftover > 0) {
      const target = remainders[cursor % remainders.length];

      if (target) {
        const share = _.get(shares, target.index, 0);

        shares[target.index] = share + 1;
        leftover -= 1;
      }

      cursor += 1;
    }

    return _.map(shares, (share) => {
      return Money.of(share, this.currency);
    });
  }

  isZero(): boolean {
    return this.amount === 0;
  }

  isNegative(): boolean {
    return this.amount < 0;
  }

  isPositive(): boolean {
    return this.amount > 0;
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.amount === other.amount;
  }

  compare(other: Money): number {
    this.assertSameCurrency(other);

    return Math.sign(this.amount - other.amount);
  }

  toMajorUnit(): number {
    return this.amount / 10 ** getCurrencyExponent(this.currency);
  }

  toJSON(): MoneyJson {
    return { amount: this.amount, currency: this.currency };
  }

  toString(): string {
    return `${this.toMajorUnit().toFixed(getCurrencyExponent(this.currency))} ${_.toUpper(this.currency)}`;
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new BadRequestError(
        `Money currency mismatch: ${this.currency} and ${other.currency} cannot be combined`,
      );
    }
  }
}
