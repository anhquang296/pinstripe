import { usePinstripeContext } from '@react/pinstripe.provider';
import type { MutationProps } from '@react/react-query.types';
import { usePinstripeMutationCallbacks } from '@react/usePinstripeMutationCallbacks';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  CouponResponse,
  CreateCouponPayload,
  CreateDiscountPayload,
  CreatePromotionCodePayload,
  DeletedCouponResponse,
  DeletedDiscountResponse,
  DiscountResponse,
  PromotionCodeResponse,
  UpdateCouponPayload,
  UpdateDiscountPayload,
  UpdatePromotionCodePayload,
} from '@type/contracts.types';

export interface UpdateCouponVariables {
  id: string;
  payload: UpdateCouponPayload;
}

export interface UpdatePromotionCodeVariables {
  id: string;
  payload: UpdatePromotionCodePayload;
}

export interface UpdateDiscountVariables {
  id: string;
  payload: UpdateDiscountPayload;
}

function useDiscountInvalidation() {
  const queryClient = useQueryClient();

  const { queries } = usePinstripeContext();

  return () => {
    queryClient.invalidateQueries({ queryKey: queries.discount.coupons._def });
    queryClient.invalidateQueries({ queryKey: queries.discount.coupon._def });
    queryClient.invalidateQueries({ queryKey: queries.discount.promotionCodes._def });
    queryClient.invalidateQueries({ queryKey: queries.discount.promotionCode._def });
    queryClient.invalidateQueries({ queryKey: queries.discount.discounts._def });
    queryClient.invalidateQueries({ queryKey: queries.discount.discount._def });
    queryClient.invalidateQueries({ queryKey: queries.invoice.invoices._def });
  };
}

export function useCreateCouponMutation({ successMessage }: MutationProps<CouponResponse> = {}) {
  const { client } = usePinstripeContext();

  const invalidate = useDiscountInvalidation();

  const { notifySuccess, notifyError } = usePinstripeMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: (payload: CreateCouponPayload) => {
      return client.coupons.create(payload);
    },
    onSuccess: (coupon) => {
      invalidate();
      notifySuccess(coupon);
    },
    onError: notifyError,
  });
}

export function useUpdateCouponMutation({ successMessage }: MutationProps<CouponResponse> = {}) {
  const { client } = usePinstripeContext();

  const invalidate = useDiscountInvalidation();

  const { notifySuccess, notifyError } = usePinstripeMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: ({ id, payload }: UpdateCouponVariables) => {
      return client.coupons.update(id, payload);
    },
    onSuccess: (coupon) => {
      invalidate();
      notifySuccess(coupon);
    },
    onError: notifyError,
  });
}

export function useDeleteCouponMutation({
  successMessage,
}: MutationProps<DeletedCouponResponse> = {}) {
  const { client } = usePinstripeContext();

  const invalidate = useDiscountInvalidation();

  const { notifySuccess, notifyError } = usePinstripeMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: (couponId: string) => {
      return client.coupons.delete(couponId);
    },
    onSuccess: (deletedCoupon) => {
      invalidate();
      notifySuccess(deletedCoupon);
    },
    onError: notifyError,
  });
}

export function useCreatePromotionCodeMutation({
  successMessage,
}: MutationProps<PromotionCodeResponse> = {}) {
  const { client } = usePinstripeContext();

  const invalidate = useDiscountInvalidation();

  const { notifySuccess, notifyError } = usePinstripeMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: (payload: CreatePromotionCodePayload) => {
      return client.promotionCodes.create(payload);
    },
    onSuccess: (promotionCode) => {
      invalidate();
      notifySuccess(promotionCode);
    },
    onError: notifyError,
  });
}

export function useUpdatePromotionCodeMutation({
  successMessage,
}: MutationProps<PromotionCodeResponse> = {}) {
  const { client } = usePinstripeContext();

  const invalidate = useDiscountInvalidation();

  const { notifySuccess, notifyError } = usePinstripeMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: ({ id, payload }: UpdatePromotionCodeVariables) => {
      return client.promotionCodes.update(id, payload);
    },
    onSuccess: (promotionCode) => {
      invalidate();
      notifySuccess(promotionCode);
    },
    onError: notifyError,
  });
}

export function useCreateDiscountMutation({
  successMessage,
}: MutationProps<DiscountResponse> = {}) {
  const { client } = usePinstripeContext();

  const invalidate = useDiscountInvalidation();

  const { notifySuccess, notifyError } = usePinstripeMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: (payload: CreateDiscountPayload) => {
      return client.discounts.create(payload);
    },
    onSuccess: (discount) => {
      invalidate();
      notifySuccess(discount);
    },
    onError: notifyError,
  });
}

export function useUpdateDiscountMutation({
  successMessage,
}: MutationProps<DiscountResponse> = {}) {
  const { client } = usePinstripeContext();

  const invalidate = useDiscountInvalidation();

  const { notifySuccess, notifyError } = usePinstripeMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: ({ id, payload }: UpdateDiscountVariables) => {
      return client.discounts.update(id, payload);
    },
    onSuccess: (discount) => {
      invalidate();
      notifySuccess(discount);
    },
    onError: notifyError,
  });
}

export function useDeleteDiscountMutation({
  successMessage,
}: MutationProps<DeletedDiscountResponse> = {}) {
  const { client } = usePinstripeContext();

  const invalidate = useDiscountInvalidation();

  const { notifySuccess, notifyError } = usePinstripeMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: (discountId: string) => {
      return client.discounts.delete(discountId);
    },
    onSuccess: (deletedDiscount) => {
      invalidate();
      notifySuccess(deletedDiscount);
    },
    onError: notifyError,
  });
}
