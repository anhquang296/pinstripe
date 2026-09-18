import RenderCheckboxField from '@components/fields/RenderCheckboxField';
import RenderNumberField from '@components/fields/RenderNumberField';
import RenderSelectField from '@components/fields/RenderSelectField';
import RenderTextField from '@components/fields/RenderTextField';
import type { TaxRateFormData } from '@forms/tax-rate-form';
import { Button } from '@heroui/react';
import { TaxTypeEnum } from '@pinstripe/core/contracts';
import type { UseFormReturn } from 'react-hook-form';

const TAX_TYPE_OPTIONS = [
  { value: TaxTypeEnum.VAT, label: 'vat — thuế giá trị gia tăng' },
  { value: TaxTypeEnum.GST, label: 'gst — hàng hoá và dịch vụ' },
  { value: TaxTypeEnum.SALES_TAX, label: 'sales_tax — thuế bán hàng' },
  { value: TaxTypeEnum.CUSTOMS, label: 'customs — thuế nhập khẩu' },
  { value: TaxTypeEnum.OTHER, label: 'other — loại khác' },
];

interface TaxRateFormProps {
  mode: 'create' | 'edit';
  form: UseFormReturn<TaxRateFormData>;
  isSaving?: boolean;
  onSave: () => void;
}

export default function TaxRateForm({ mode, form, isSaving, onSave }: TaxRateFormProps) {
  const isEdit = mode === 'edit';

  return (
    <form
      className="flex flex-wrap items-end gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <RenderTextField
        control={form.control}
        name="displayName"
        label="Tên hiển thị"
        placeholder="VAT 10%"
      />
      <RenderTextField
        control={form.control}
        name="description"
        label="Mô tả"
        placeholder="Thuế GTGT dịch vụ"
      />
      <RenderNumberField
        control={form.control}
        name="percentage"
        label="Thuế suất (%)"
        minValue={0}
        maxValue={100}
        className="w-32"
        isDisabled={isEdit}
      />
      <RenderSelectField
        control={form.control}
        name="taxType"
        label="Loại thuế"
        options={TAX_TYPE_OPTIONS}
        isDisabled={isEdit}
      />
      <RenderTextField
        control={form.control}
        name="jurisdiction"
        label="Phạm vi áp dụng"
        placeholder="Việt Nam"
      />
      <RenderTextField
        control={form.control}
        name="country"
        label="Quốc gia"
        placeholder="VN"
        className="w-24"
        isDisabled={isEdit}
      />
      <RenderCheckboxField
        control={form.control}
        name="inclusive"
        label="Đã gồm trong giá"
        isDisabled={isEdit}
      />
      <RenderCheckboxField control={form.control} name="active" label="Đang áp dụng" />
      <Button type="submit" isDisabled={isSaving}>
        {isEdit ? 'Lưu thay đổi' : 'Tạo tax rate'}
      </Button>
    </form>
  );
}
