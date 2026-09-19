import { zodResolver } from '@hookform/resolvers/zod';
import { toEnumMember } from '@lib/enum';
import { TaxTypeEnum } from '@pinstripe/core/contracts';
import type { CreateTaxRatePayload, TaxRateResponse, UpdateTaxRatePayload } from '@pinstripe/sdk';
import { z } from 'zod';

const taxRateFormSchema = z.object({
  displayName: z.string().min(1, 'Tên hiển thị là bắt buộc'),
  description: z.string(),
  percentage: z
    .number({ message: 'Thuế suất phải là số' })
    .min(0, 'Thuế suất không âm')
    .max(100, 'Thuế suất tối đa 100%'),
  taxType: z.nativeEnum(TaxTypeEnum, { message: 'Chọn loại thuế' }),
  inclusive: z.boolean(),
  jurisdiction: z.string(),
  country: z.string(),
  active: z.boolean(),
});

export type TaxRateFormData = z.infer<typeof taxRateFormSchema>;

export const taxRateFormResolver = zodResolver(taxRateFormSchema);

export const taxRateFormDefaultValues: TaxRateFormData = {
  displayName: '',
  description: '',
  percentage: 10,
  taxType: TaxTypeEnum.VAT,
  inclusive: false,
  jurisdiction: '',
  country: 'VN',
  active: true,
};

export function taxRateToFormData(taxRate: TaxRateResponse): TaxRateFormData {
  const { country } = taxRate;

  return {
    displayName: taxRate.displayName,
    description: taxRate.description,
    percentage: taxRate.percentage,
    taxType: toEnumMember(TaxTypeEnum, taxRate.taxType, TaxTypeEnum.VAT),
    inclusive: taxRate.inclusive,
    jurisdiction: taxRate.jurisdiction,
    country: country ?? '',
    active: taxRate.active,
  };
}

export function taxRateFormDataToPayload(formData: TaxRateFormData): CreateTaxRatePayload {
  return {
    displayName: formData.displayName,
    description: formData.description || undefined,
    percentage: formData.percentage,
    taxType: formData.taxType,
    inclusive: formData.inclusive,
    jurisdiction: formData.jurisdiction || undefined,
    country: formData.country || undefined,
    active: formData.active,
  };
}

export function taxRateFormDataToUpdatePayload(formData: TaxRateFormData): UpdateTaxRatePayload {
  return {
    displayName: formData.displayName,
    description: formData.description,
    jurisdiction: formData.jurisdiction || undefined,
    active: formData.active,
  };
}
