import DataTable from '@components/DataTable';
import EntityDrawer from '@components/EntityDrawer';
import FilterBar from '@components/FilterBar';
import LedgerTransactionForm from '@components/LedgerTransactionForm';
import PageCard from '@components/PageCard';
import PageTabs from '@components/PageTabs';
import StatGrid from '@components/StatGrid';
import StatItem from '@components/StatItem';
import { PAGE_LIMIT } from '@constants/pagination';
import { LEDGER_TABS } from '@constants/tabs';
import type { LedgerTransactionFormData } from '@forms/ledger-transaction-form';
import {
  ledgerTransactionFormDataToPayload,
  ledgerTransactionFormDefaultValues,
  ledgerTransactionFormResolver,
} from '@forms/ledger-transaction-form';
import { Button } from '@heroui/react';
import { useCursorPagination } from '@hooks/useCursorPagination';
import { formatDate } from '@lib/format';
import { useCan } from '@lib/permissions';
import type { LedgerTransactionResponse } from '@pinstripe/core/contracts';
import { PermissionEnum } from '@pinstripe/core/contracts';
import {
  useCreateLedgerTransactionMutation,
  useLedgerTransactionsQuery,
} from '@pinstripe/sdk/react';
import { filter, get, last, size, sumBy } from 'lodash-es';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';

import LedgerTransactionDrawer from './LedgerTransactionDrawer';

export default function LedgerTransactionsPage() {
  const { transactionId } = useParams();
  const navigate = useNavigate();
  const [searchCustomerId, setSearchCustomerId] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { startingAfter, hasPrevious, advancePage, revertPage, resetPage } = useCursorPagination();
  const canWrite = useCan(PermissionEnum.LEDGER_WRITE);

  const { data: ledgerTransactions, isPending } = useLedgerTransactionsQuery(
    { limit: PAGE_LIMIT, startingAfter, customerId: searchCustomerId || undefined },
    { hasPlaceholder: true },
  );

  const { mutateAsync: createLedgerTransaction, isPending: isSaving } =
    useCreateLedgerTransactionMutation({ successMessage: 'Đã ghi bút toán.' });

  const form = useForm<LedgerTransactionFormData>({
    resolver: ledgerTransactionFormResolver,
    defaultValues: ledgerTransactionFormDefaultValues,
  });

  const rows = get(ledgerTransactions, 'data', []);
  const hasMore = get(ledgerTransactions, 'hasMore', false);

  const handleOnSave = form.handleSubmit(async (formData) => {
    await createLedgerTransaction(ledgerTransactionFormDataToPayload(formData));
    form.reset(ledgerTransactionFormDefaultValues);
    setIsCreateOpen(false);
  });

  const handleOnSearchChange = (nextCustomerId: string) => {
    setSearchCustomerId(nextCustomerId);
    resetPage();
  };

  const handleOnNext = () => {
    const lastTransaction = last(rows);

    if (lastTransaction) {
      advancePage(lastTransaction.id);
    }
  };

  const handleOnRowAction = (ledgerTransaction: LedgerTransactionResponse) => {
    navigate(`/ledger/transactions/${ledgerTransaction.id}`);
  };

  const handleOnCloseDetail = () => {
    navigate('/ledger/transactions');
  };

  return (
    <PageCard
      title="Ledger"
      description="Bút toán đã ghi không sửa được. Sai thì ghi một bút toán đảo, và cả hai cùng ở lại trong sổ."
      tabs={<PageTabs items={LEDGER_TABS} />}
      actions={
        canWrite ? (
          <Button
            onPress={() => {
              setIsCreateOpen(true);
            }}
          >
            Ghi bút toán
          </Button>
        ) : null
      }
    >
      <StatGrid>
        <StatItem label="Bút toán trang này" value={size(rows)} />
        <StatItem
          label="Tổng số dòng"
          value={sumBy(rows, (ledgerTransaction) => {
            return size(ledgerTransaction.postings);
          })}
        />
        <StatItem label="Bút toán đảo" value={size(filter(rows, 'reversesTransactionId'))} />
        <StatItem label="Đã bị đảo" value={size(filter(rows, 'reversedByTransactionId'))} />
      </StatGrid>

      <div className="border-app-border-soft flex flex-col rounded-md border bg-surface">
        <FilterBar
          itemCount={size(rows)}
          searchValue={searchCustomerId}
          searchPlaceholder="Lọc theo customer id"
          onSearchChange={handleOnSearchChange}
        />

        <DataTable
          label="Danh sách bút toán"
          rows={rows}
          isLoading={isPending}
          hasMore={hasMore}
          hasPrevious={hasPrevious}
          emptyMessage="Chưa có bút toán nào."
          onRowAction={handleOnRowAction}
          onNext={handleOnNext}
          onPrevious={revertPage}
          columns={[
            {
              key: 'description',
              label: 'Diễn giải',
              isRowHeader: true,
              renderCell: (ledgerTransaction) => {
                return (
                  <div className="flex flex-col">
                    <span className="font-medium">{ledgerTransaction.description}</span>
                    <span className="text-app-label font-mono text-[11px]">
                      {ledgerTransaction.id}
                    </span>
                  </div>
                );
              },
            },
            {
              key: 'postings',
              label: 'Số dòng',
              renderCell: (ledgerTransaction) => {
                return size(ledgerTransaction.postings);
              },
            },
            {
              key: 'externalId',
              label: 'Mã đối chiếu',
              renderCell: (ledgerTransaction) => {
                return ledgerTransaction.externalId ?? '—';
              },
            },
            {
              key: 'reversedByTransactionId',
              label: 'Bị đảo bởi',
              renderCell: (ledgerTransaction) => {
                return ledgerTransaction.reversedByTransactionId ?? '—';
              },
            },
            {
              key: 'effectiveAt',
              label: 'Hiệu lực',
              renderCell: (ledgerTransaction) => {
                return formatDate(ledgerTransaction.effectiveAt);
              },
            },
          ]}
        />
      </div>

      <EntityDrawer
        isOpen={isCreateOpen}
        title="Ghi bút toán"
        description="Tổng nợ phải bằng tổng có, nếu không sổ sẽ từ chối."
        onOpenChange={setIsCreateOpen}
      >
        <LedgerTransactionForm form={form} isSaving={isSaving} onSave={handleOnSave} />
      </EntityDrawer>

      {transactionId ? (
        <LedgerTransactionDrawer transactionId={transactionId} onClose={handleOnCloseDetail} />
      ) : null}
    </PageCard>
  );
}
