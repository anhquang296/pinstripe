import RenderSelectField from '@components/fields/RenderSelectField';
import RenderTextField from '@components/fields/RenderTextField';
import type { TaxIdFormData } from '@forms/tax-id-form';
import { Button } from '@heroui/react';
import { TaxIdTypeEnum } from '@pinstripe/core/contracts';
import type { UseFormReturn } from 'react-hook-form';

const TAX_ID_TYPE_OPTIONS = [
  { value: TaxIdTypeEnum.VN_TIN, label: 'vn_tin — mã số thuế Việt Nam' },
  { value: TaxIdTypeEnum.EU_VAT, label: 'eu_vat — VAT châu Âu' },
  { value: TaxIdTypeEnum.US_EIN, label: 'us_ein — EIN Hoa Kỳ' },
  { value: TaxIdTypeEnum.OTHER, label: 'other — loại khác' },
];

interface TaxIdFormProps {
  form: UseFormReturn<TaxIdFormData>;
  isSaving?: boolean;
  onSave: () => void;
}

export default function TaxIdForm({ form, isSaving, onSave }: TaxIdFormProps) {
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <RenderSelectField
        control={form.control}
        name="type"
        label="Loại"
        options={TAX_ID_TYPE_OPTIONS}
      />
      <RenderTextField
        control={form.control}
        name="value"
        label="Mã số thuế"
        placeholder="0101243150"
      />
      <RenderTextField control={form.control} name="country" label="Quốc gia" placeholder="VN" />
      <Button type="submit" isDisabled={isSaving}>
        Thêm mã số thuế
      </Button>
    </form>
  );
}
