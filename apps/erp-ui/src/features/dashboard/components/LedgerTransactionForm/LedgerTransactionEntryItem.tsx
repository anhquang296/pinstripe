import RenderNumberField from '@common/components/FormField/RenderNumberField';
import RenderSelectField from '@common/components/FormField/RenderSelectField';
import RenderTextField from '@common/components/FormField/RenderTextField';
import type { LedgerTransactionFormData } from '@common/forms/ledger-transaction-form';
import { Button, Card } from '@heroui/react';
import { LedgerAccountCodeEnum, PostingDirectionEnum } from '@vxrerp/core/contracts';
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
    <Card className="gap-4 p-3">
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
      />
      <RenderNumberField
        control={form.control}
        name={`entries.${index}.amount`}
        label="Số tiền"
        minValue={1}
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
    </Card>
  );
}
