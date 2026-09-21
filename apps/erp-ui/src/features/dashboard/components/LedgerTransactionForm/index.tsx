import RenderSelectField from '@common/components/FormField/RenderSelectField';
import RenderTextField from '@common/components/FormField/RenderTextField';
import type { LedgerTransactionFormData } from '@common/forms/ledger-transaction-form';
import { Button } from '@heroui/react';
import { CurrencyEnum, LedgerAccountCodeEnum, PostingDirectionEnum } from '@vxrerp/core/contracts';
import { get, map, values } from 'lodash-es';
import type { UseFormReturn } from 'react-hook-form';
import { useFieldArray } from 'react-hook-form';

import LedgerTransactionEntryItem from './LedgerTransactionEntryItem';

const CURRENCY_OPTIONS = map(values(CurrencyEnum), (currency) => {
  return { value: currency, label: currency };
});

interface LedgerTransactionFormProps {
  form: UseFormReturn<LedgerTransactionFormData>;
  isSaving?: boolean;
  onSave: () => void;
}

export default function LedgerTransactionForm({
  form,
  isSaving,
  onSave,
}: LedgerTransactionFormProps) {
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'entries' });

  const entriesError = get(form.formState.errors.entries, 'root.message');

  const handleOnAddEntry = () => {
    append({
      accountCode: LedgerAccountCodeEnum.CASH,
      customerId: '',
      direction: PostingDirectionEnum.DEBIT,
      amount: 0,
    });
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <div className="flex flex-col gap-4">
        <RenderTextField
          control={form.control}
          name="description"
          label="Diễn giải"
          placeholder="Ghi nhận doanh thu tháng 9"
        />
        <RenderSelectField
          control={form.control}
          name="currency"
          label="Tiền tệ"
          options={CURRENCY_OPTIONS}
        />
        <RenderTextField
          control={form.control}
          name="externalId"
          label="Mã đối chiếu"
          placeholder="ref_202509"
        />
      </div>

      {map(fields, (field, index) => {
        return (
          <LedgerTransactionEntryItem key={field.id} form={form} index={index} onRemove={remove} />
        );
      })}

      {entriesError ? <span className="text-[12px] text-danger">{entriesError}</span> : null}

      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" onPress={handleOnAddEntry}>
          Thêm dòng
        </Button>
        <Button type="submit" isDisabled={isSaving}>
          Ghi bút toán
        </Button>
      </div>
    </form>
  );
}
