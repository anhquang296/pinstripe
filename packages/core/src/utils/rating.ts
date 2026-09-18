import type {
  BillingScheme,
  PriceResponse,
  RoundingMode,
  TiersMode,
} from '@contracts/prices.types';
import { BillingSchemeEnum, RoundingModeEnum, TiersModeEnum } from '@contracts/prices.types';
import { BadRequestError } from '@errors/app.error';
import type { Currency } from '@utils/currency';
import type { RoundingPolicy } from '@utils/money';
import { Money, RoundingPolicyEnum } from '@utils/money';
import _ from 'lodash';

const RATING_ROUNDING_POLICY: RoundingPolicy = RoundingPolicyEnum.HALF_UP;

export enum LineItemTypeEnum {
  SUBSCRIPTION = 'subscription',
  USAGE = 'usage',
  PRORATION = 'proration',
  INVOICEITEM = 'invoiceitem',
  DISCOUNT = 'discount',
  TAX = 'tax',
}
export type LineItemType = `${LineItemTypeEnum}`;

export type PriceTier = NonNullable<PriceResponse['tiers']>[number];

export interface RatingPrice {
  id: string;
  currency: Currency;
  billingScheme: BillingScheme;
  unitAmount: number | null;
  tiersMode: TiersMode | null;
  tiers: PriceTier[] | null;
  transformQuantity: { divideBy: number; round: RoundingMode } | null;
}

export interface RatingLine {
  subscriptionItemId: string;
  subscriptionItemChangeId: string;
  price: RatingPrice;
  type: LineItemType;
  quantity: number;
  periodStart: Date;
  periodEnd: Date;
  usageStart: Date | null;
  usageEnd: Date | null;
  isCredit: boolean;
}

export interface RatedLineItem {
  subscriptionItemId: string;
  subscriptionItemChangeId: string;
  priceId: string;
  type: LineItemType;
  quantity: number;
  ratedQuantity: number;
  amount: Money;
  periodStart: Date;
  periodEnd: Date;
  prorationFactor: number;
  isCredit: boolean;
}

export interface RatingResult {
  lineItems: RatedLineItem[];
  total: Money;
  currency: Currency;
}

export interface BillingWindow {
  start: Date;
  end: Date;
  isPartial: boolean;
}

export function resolveBillingWindow(
  billedFrom: Date,
  billedThrough: Date | null,
  invoicedThrough: Date | null,
  periodStart: Date,
  periodEnd: Date,
): BillingWindow | null {
  const invoicedThroughMs = invoicedThrough ? invoicedThrough.getTime() : periodStart.getTime();
  const billedThroughMs = billedThrough ? billedThrough.getTime() : periodEnd.getTime();
  const startMs = Math.max(billedFrom.getTime(), periodStart.getTime(), invoicedThroughMs);
  const endMs = Math.min(billedThroughMs, periodEnd.getTime());

  if (endMs <= startMs) {
    return null;
  }

  return {
    start: new Date(startMs),
    end: new Date(endMs),
    isPartial: startMs > periodStart.getTime() || endMs < periodEnd.getTime(),
  };
}

export function resolveCreditWindow(
  billedThrough: Date | null,
  invoicedThrough: Date | null,
  periodStart: Date,
  periodEnd: Date,
): BillingWindow | null {
  if (!billedThrough || !invoicedThrough) {
    return null;
  }

  const startMs = Math.max(billedThrough.getTime(), periodStart.getTime());
  const endMs = Math.min(invoicedThrough.getTime(), periodEnd.getTime());

  if (endMs <= startMs) {
    return null;
  }

  return { start: new Date(startMs), end: new Date(endMs), isPartial: true };
}

export function transformQuantity(price: RatingPrice, quantity: number): number {
  const transform = price.transformQuantity;

  if (transform) {
    const divided = quantity / transform.divideBy;

    if (transform.round === RoundingModeEnum.DOWN) {
      return Math.floor(divided);
    }

    return Math.ceil(divided);
  }

  return quantity;
}

function toTierFloor(tiers: readonly PriceTier[], index: number): number {
  const previous = tiers[index - 1];

  if (previous) {
    const upTo = previous.upTo;

    if (_.isNil(upTo)) {
      throw new BadRequestError('Tiered price has an unbounded tier before its last tier');
    }

    return upTo;
  }

  return 0;
}

function rateGraduatedTiers(
  tiers: readonly PriceTier[],
  quantity: number,
  currency: Currency,
): Money {
  const amounts = _.map(tiers, (tier, index) => {
    const floor = toTierFloor(tiers, index);
    const ceiling = _.isNil(tier.upTo) ? quantity : Math.min(tier.upTo, quantity);
    const unitsInTier = Math.max(ceiling - floor, 0);

    if (unitsInTier <= 0) {
      return Money.zero(currency);
    }

    const { flatAmount: tierFlatAmount = 0, unitAmount: tierUnitAmount = 0 } = tier;
    const flatAmount = Money.of(tierFlatAmount, currency);
    const unitAmount = Money.of(tierUnitAmount, currency);

    return flatAmount.add(unitAmount.multiply(unitsInTier, RATING_ROUNDING_POLICY));
  });

  return Money.sum(amounts, currency);
}

function rateVolumeTiers(tiers: readonly PriceTier[], quantity: number, currency: Currency): Money {
  const tier = _.find(tiers, (candidate) => {
    return _.isNil(candidate.upTo) || quantity <= candidate.upTo;
  });

  if (tier) {
    const { flatAmount: tierFlatAmount = 0, unitAmount: tierUnitAmount = 0 } = tier;
    const flatAmount = Money.of(tierFlatAmount, currency);
    const unitAmount = Money.of(tierUnitAmount, currency);

    return flatAmount.add(unitAmount.multiply(quantity, RATING_ROUNDING_POLICY));
  }

  throw new BadRequestError('Tiered price has no tier covering the rated quantity');
}

export function ratePrice(price: RatingPrice, quantity: number): Money {
  if (quantity < 0) {
    throw new BadRequestError(`Price ${price.id} cannot be rated for a negative quantity`);
  }

  const ratedQuantity = transformQuantity(price, quantity);

  if (ratedQuantity === 0) {
    return Money.zero(price.currency);
  }

  if (price.billingScheme === BillingSchemeEnum.PER_UNIT) {
    const { unitAmount: priceUnitAmount } = price;
    const unitMinorAmount = priceUnitAmount === null ? 0 : priceUnitAmount;
    const unitAmount = Money.of(unitMinorAmount, price.currency);

    return unitAmount.multiply(ratedQuantity, RATING_ROUNDING_POLICY);
  }

  const tiers = price.tiers;

  if (_.isEmpty(tiers) || !tiers) {
    throw new BadRequestError(`Price ${price.id} is tiered but carries no tiers`);
  }

  if (price.tiersMode === TiersModeEnum.VOLUME) {
    return rateVolumeTiers(tiers, ratedQuantity, price.currency);
  }

  return rateGraduatedTiers(tiers, ratedQuantity, price.currency);
}

export function resolveProrationFactor(line: RatingLine): number {
  const usageStart = line.usageStart;
  const usageEnd = line.usageEnd;

  if (usageStart && usageEnd) {
    const periodMs = line.periodEnd.getTime() - line.periodStart.getTime();

    if (periodMs <= 0) {
      throw new BadRequestError('Rating period must end after it starts');
    }

    const usedMs = usageEnd.getTime() - usageStart.getTime();

    return _.clamp(usedMs / periodMs, 0, 1);
  }

  return 1;
}

export function rateLine(line: RatingLine): RatedLineItem {
  const fullAmount = ratePrice(line.price, line.quantity);
  const prorationFactor = resolveProrationFactor(line);
  const proratedAmount = fullAmount.multiply(prorationFactor, RATING_ROUNDING_POLICY);
  const amount = line.isCredit ? proratedAmount.negate() : proratedAmount;

  return {
    subscriptionItemId: line.subscriptionItemId,
    subscriptionItemChangeId: line.subscriptionItemChangeId,
    priceId: line.price.id,
    type: line.type,
    quantity: line.quantity,
    ratedQuantity: transformQuantity(line.price, line.quantity),
    amount,
    periodStart: line.periodStart,
    periodEnd: line.periodEnd,
    prorationFactor,
    isCredit: line.isCredit,
  };
}

export function rateLines(lines: readonly RatingLine[], currency: Currency): RatingResult {
  const lineItems = _.map(lines, rateLine);
  const total = Money.sum(_.map(lineItems, 'amount'), currency);

  return { lineItems, total, currency };
}
