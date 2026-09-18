import { usePinstripeQueries } from '@react/pinstripe.provider';
import type { QueryProps } from '@react/react-query.types';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type {
  FindCouponsQuery,
  FindDiscountsQuery,
  FindPromotionCodesQuery,
} from '@type/contracts.types';

export function useCouponsQuery(
  query?: FindCouponsQuery,
  { enabled = true, hasPlaceholder = false }: QueryProps = {},
) {
  const queries = usePinstripeQueries();

  return useQuery({
    ...queries.discount.coupons(query),
    enabled,
    placeholderData: hasPlaceholder ? keepPreviousData : undefined,
  });
}

export function useCouponQuery(couponId: string, { enabled = true }: QueryProps = {}) {
  const queries = usePinstripeQueries();

  return useQuery({ ...queries.discount.coupon(couponId), enabled: enabled && Boolean(couponId) });
}

export function usePromotionCodesQuery(
  query?: FindPromotionCodesQuery,
  { enabled = true, hasPlaceholder = false }: QueryProps = {},
) {
  const queries = usePinstripeQueries();

  return useQuery({
    ...queries.discount.promotionCodes(query),
    enabled,
    placeholderData: hasPlaceholder ? keepPreviousData : undefined,
  });
}

export function useDiscountsQuery(
  query?: FindDiscountsQuery,
  { enabled = true, hasPlaceholder = false }: QueryProps = {},
) {
  const queries = usePinstripeQueries();

  return useQuery({
    ...queries.discount.discounts(query),
    enabled,
    placeholderData: hasPlaceholder ? keepPreviousData : undefined,
  });
}

export function useDiscountQuery(discountId: string, { enabled = true }: QueryProps = {}) {
  const queries = usePinstripeQueries();

  return useQuery({
    ...queries.discount.discount(discountId),
    enabled: enabled && Boolean(discountId),
  });
}
