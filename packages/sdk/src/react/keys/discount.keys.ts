import type { PinstripeClient } from '@client/pinstripe.client';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import { PinstripeQuerySubjectEnum } from '@react/pinstripe-query-subject';
import type {
  FindCouponsQuery,
  FindDiscountsQuery,
  FindPromotionCodesQuery,
} from '@type/contracts.types';

export function createDiscountQueries(client: PinstripeClient) {
  return createQueryKeys(PinstripeQuerySubjectEnum.DISCOUNT, {
    coupons: (query?: FindCouponsQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.coupons.find(query);
        },
      };
    },
    coupon: (couponId: string) => {
      return {
        queryKey: [couponId],
        queryFn: () => {
          return client.coupons.get(couponId);
        },
      };
    },
    promotionCodes: (query?: FindPromotionCodesQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.promotionCodes.find(query);
        },
      };
    },
    discounts: (query?: FindDiscountsQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.discounts.find(query);
        },
      };
    },
    discount: (discountId: string) => {
      return {
        queryKey: [discountId],
        queryFn: () => {
          return client.discounts.get(discountId);
        },
      };
    },
  });
}
