import { zodResolver } from '@hookform/resolvers/zod';
import { PaymentCancellationReasonEnum } from '@pinstripe/core/contracts';
import type { CancelPaymentIntentPayload } from '@pinstripe/sdk';
import { z } from 'zod';

const cancelPaymentIntentFormSchema = z.object({
  cancellationReason: z.nativeEnum(PaymentCancellationReasonEnum, { message: 'Chọn lý do huỷ' }),
});

export type CancelPaymentIntentFormData = z.infer<typeof cancelPaymentIntentFormSchema>;

export const cancelPaymentIntentFormResolver = zodResolver(cancelPaymentIntentFormSchema);

export const cancelPaymentIntentFormDefaultValues: CancelPaymentIntentFormData = {
  cancellationReason: PaymentCancellationReasonEnum.REQUESTED_BY_CUSTOMER,
};

export function cancelPaymentIntentFormDataToPayload(
  formData: CancelPaymentIntentFormData,
): CancelPaymentIntentPayload {
  return {
    cancellationReason: formData.cancellationReason,
  };
}
