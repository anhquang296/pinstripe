import RenderNumberField from '@components/fields/RenderNumberField';
import RenderSelectField from '@components/fields/RenderSelectField';
import RenderTextField from '@components/fields/RenderTextField';
import type { LedgerTransactionFormData } from '@forms/ledger-transaction-form';
import { Button } from '@heroui/react';
import { LedgerAccountCodeEnum, PostingDirectionEnum } from '@pinstripe/core/contracts';
import { map, values } from 'lodash-es';
import type { UseFormReturn } from 'react-hook-form';

const ACCOUNT_CODE_OPTIONS = map(values(LedgerAccountCodeEnum), (accountCode) => {
  return { value: accountCode, label: accountCode };
});

const DIRECTION_OPTIONS = [
  { value: PostingDirectionEnum.DEBIT, label: 'Nợ' },
  { value: PostingDirectionEnum.CREDIT, label: 'Có' },
];

interface LedgerTransactionEntryItemProps {
  form: UseFormReturn<LedgerTransactionFormData>;
  index: number;
  onRemove: (index: number) => void;
}

export default function LedgerTransactionEntryItem({
  form,
  index,
  onRemove,
}: LedgerTransactionEntryItemProps) {
  const handleOnRemove = () => {
    onRemove(index);
  };

  return (
    <div className="border-app-border-soft flex flex-wrap items-end gap-4 rounded-md border bg-background p-3">
      <RenderSelectField
        control={form.control}
        name={`entries.${index}.accountCode`}
        label="Tài khoản"
        options={ACCOUNT_CODE_OPTIONS}
      />
      <RenderSelectField
        control={form.control}
        name={`entries.${index}.direction`}
        label="Chiều"
        options={DIRECTION_OPTIONS}
        className="w-28"
      />
      <RenderNumberField
        control={form.control}
        name={`entries.${index}.amount`}
        label="Số tiền"
        minValue={1}
        className="w-40"
      />
      <RenderTextField
        control={form.control}
        name={`entries.${index}.customerId`}
        label="Customer (nếu tài khoản theo khách)"
        placeholder="cus_..."
      />
      <Button type="button" variant="ghost" onPress={handleOnRemove}>
        Xoá dòng
      </Button>
    </div>
  );
}
