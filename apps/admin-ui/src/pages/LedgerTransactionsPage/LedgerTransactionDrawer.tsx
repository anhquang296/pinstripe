import DataTable from '@components/DataTable';
import DetailList from '@components/DetailList';
import DrawerSection from '@components/DrawerSection';
import EntityDrawer from '@components/EntityDrawer';
import ReverseTransactionForm from '@components/ReverseTransactionForm';
import type { ReverseTransactionFormData } from '@forms/reverse-transaction-form';
import {
  reverseTransactionFormDataToPayload,
  reverseTransactionFormDefaultValues,
  reverseTransactionFormResolver,
} from '@forms/reverse-transaction-form';
import { Button } from '@heroui/react';
import { formatCurrency, formatDate } from '@lib/format';
import { useCan } from '@lib/permissions';
import { CurrencyEnum, PermissionEnum } from '@pinstripe/core/contracts';
import {
  useLedgerTransactionQuery,
  useReverseLedgerTransactionMutation,
} from '@pinstripe/sdk/react';
import { get } from 'lodash-es';
import { useForm } from 'react-hook-form';

interface LedgerTransactionDrawerProps {
  transactionId: string;
  onClose: () => void;
}

export default function LedgerTransactionDrawer({
  transactionId,
  onClose,
}: LedgerTransactionDrawerProps) {
  const canWrite = useCan(PermissionEnum.LEDGER_WRITE);

  const { data: ledgerTransaction } = useLedgerTransactionQuery(transactionId);
  const { mutateAsync: reverseLedgerTransaction, isPending: isReversing } =
    useReverseLedgerTransactionMutation({ successMessage: 'Đã đảo bút toán.' });

  const form = useForm<ReverseTransactionFormData>({
    resolver: reverseTransactionFormResolver,
    defaultValues: reverseTransactionFormDefaultValues,
  });

  const currency = get(ledgerTransaction, 'currency', CurrencyEnum.VND);
  const reversedByTransactionId = get(ledgerTransaction, 'reversedByTransactionId');

  const handleOnReverse = form.handleSubmit(async (formData) => {
    await reverseLedgerTransaction({
      id: transactionId,
      payload: reverseTransactionFormDataToPayload(formData),
    });
    form.reset(reverseTransactionFormDefaultValues);
    onClose();
  });

  return (
    <EntityDrawer
      isOpen
      title={get(ledgerTransaction, 'description', transactionId)}
      description={transactionId}
      footer={
        <Button variant="ghost" onPress={onClose}>
          Đóng
        </Button>
      }
      onOpenChange={onClose}
    >
      <div className="flex flex-col gap-4">
        <DrawerSection title="Tóm tắt">
          <DetailList
            items={[
              { label: 'Tiền tệ', value: currency },
              { label: 'Mã đối chiếu', value: get(ledgerTransaction, 'externalId') ?? '—' },
              {
                label: 'Hiệu lực',
                value: formatDate(get(ledgerTransaction, 'effectiveAt', '')),
              },
              {
                label: 'Đảo bút toán',
                value: get(ledgerTransaction, 'reversesTransactionId') ?? '—',
              },
              { label: 'Bị đảo bởi', value: reversedByTransactionId ?? '—' },
              { label: 'Tạo lúc', value: formatDate(get(ledgerTransaction, 'createdAt', '')) },
            ]}
          />
        </DrawerSection>

        <DataTable
          label="Các dòng bút toán"
          rows={get(ledgerTransaction, 'postings', [])}
          emptyMessage="Bút toán này chưa có dòng nào."
          columns={[
            {
              key: 'accountCode',
              label: 'Tài khoản',
              isRowHeader: true,
              renderCell: (posting) => {
                return posting.accountCode;
              },
            },
            {
              key: 'direction',
              label: 'Chiều',
              renderCell: (posting) => {
                return posting.direction;
              },
            },
            {
              key: 'amount',
              label: 'Số tiền',
              renderCell: (posting) => {
                return formatCurrency(posting.amount, posting.currency);
              },
            },
            {
              key: 'accountId',
              label: 'Account id',
              renderCell: (posting) => {
                return <span className="font-mono text-[11px]">{posting.accountId}</span>;
              },
            },
          ]}
        />

        {canWrite && !reversedByTransactionId ? (
          <DrawerSection title="Đảo bút toán">
            <ReverseTransactionForm
              form={form}
              transactionId={transactionId}
              isSaving={isReversing}
              onSave={handleOnReverse}
            />
          </DrawerSection>
        ) : null}
      </div>
    </EntityDrawer>
  );
}
