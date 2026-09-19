import { zodResolver } from '@hookform/resolvers/zod';
import { TaxIdTypeEnum } from '@pinstripe/core/contracts';
import type { CreateTaxIdPayload } from '@pinstripe/sdk';
import { z } from 'zod';

const taxIdFormSchema = z.object({
  type: z.nativeEnum(TaxIdTypeEnum, { message: 'Chọn loại mã số thuế' }),
  value: z.string().min(1, 'Mã số thuế là bắt buộc'),
  country: z.string(),
});

export type TaxIdFormData = z.infer<typeof taxIdFormSchema>;

export const taxIdFormResolver = zodResolver(taxIdFormSchema);

export const taxIdFormDefaultValues: TaxIdFormData = {
  type: TaxIdTypeEnum.VN_TIN,
  value: '',
  country: 'VN',
};

export function taxIdFormDataToPayload(
  customerId: string,
  formData: TaxIdFormData,
): CreateTaxIdPayload {
  return {
    customerId,
    type: formData.type,
    value: formData.value,
    country: formData.country || undefined,
  };
}
