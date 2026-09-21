import type { RecurringInterval } from '@contracts/prices.types';
import { PriceTypeEnum } from '@contracts/prices.types';
import type { Price } from '@database/schemas';
import { BadRequestError } from '@vxrerp/platform/errors';
import _ from 'lodash';

export interface SubscriptionInterval {
  interval: RecurringInterval;
  intervalCount: number;
}

export function resolveInterval(prices: readonly Price[]): SubscriptionInterval {
  const [firstPrice] = prices;

  const interval = _.get(firstPrice, 'recurringInterval');
  const intervalCount = _.get(firstPrice, 'recurringIntervalCount');

  if (interval && intervalCount) {
    return { interval, intervalCount };
  }

  throw new BadRequestError('A subscription needs at least one recurring price', {
    param: 'items',
  });
}

export function assertPricesUsable(prices: readonly Price[], currency: string): void {
  for (const price of prices) {
    if (!price.active) {
      throw new BadRequestError(`Price ${price.id} is archived and cannot be subscribed to`, {
        param: 'items',
      });
    }

    if (price.type !== PriceTypeEnum.RECURRING) {
      throw new BadRequestError(`Price ${price.id} is one time and cannot be subscribed to`, {
        param: 'items',
      });
    }

    if (price.currency !== currency) {
      throw new BadRequestError(
        `Price ${price.id} is in ${price.currency} but the customer bills in ${currency}`,
        { param: 'items' },
      );
    }
  }

  const [firstPrice] = prices;

  if (firstPrice) {
    const mismatchedPrice = _.find(prices, (price) => {
      return (
        price.recurringInterval !== firstPrice.recurringInterval ||
        price.recurringIntervalCount !== firstPrice.recurringIntervalCount
      );
    });

    if (mismatchedPrice) {
      throw new BadRequestError(
        'Every price on a subscription must share the same billing period',
        {
          param: 'items',
        },
      );
    }

    return;
  }

  throw new BadRequestError('A subscription needs at least one price', { param: 'items' });
}
