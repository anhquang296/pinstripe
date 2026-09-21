import DataTable from '@common/components/DataTable';
import DrawerSection from '@common/components/DrawerSection';
import EntityCell from '@common/components/EntityCell';
import EntityDrawer from '@common/components/EntityDrawer';
import FilterBar from '@common/components/FilterBar';
import PageCard from '@common/components/PageCard';
import PageTabs from '@common/components/PageTabs';
import StatGrid from '@common/components/StatGrid';
import StatItem from '@common/components/StatItem';
import { PAGE_LIMIT } from '@common/constants/pagination';
import { SEARCH_DEBOUNCE_MS } from '@common/constants/time';
import type { LedgerTransactionFormData } from '@common/forms/ledger-transaction-form';
import {
  ledgerTransactionFormDataToPayload,
  ledgerTransactionFormDefaultValues,
  ledgerTransactionFormResolver,
} from '@common/forms/ledger-transaction-form';
import { useCursorPagination } from '@common/hooks/useCursorPagination';
import { useSearchPreservingNavigate } from '@common/hooks/useSearchPreservingNavigate';
import { formatDate } from '@common/utils/format';
import { toQuery } from '@common/utils/search-params';
import LedgerTransactionForm from '@features/dashboard/components/LedgerTransactionForm';
import { LEDGER_TABS } from '@features/dashboard/constants/tabs';
import { Button } from '@heroui/react';
import { useCan } from '@libs/permissions';
import type { LedgerTransactionResponse } from '@vxrerp/core/contracts';
import { PermissionEnum } from '@vxrerp/core/contracts';
import { useCreateLedgerTransactionMutation, useLedgerTransactionsQuery } from '@vxrerp/sdk/react';
import { filter, get, isEmpty, last, size, sumBy } from 'lodash-es';
import { debounce, useQueryStates } from 'nuqs';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useParams } from 'react-router-dom';

import { ledgerTransactionSearchParams } from './ledger-transactions.search-params';
import LedgerTransactionDrawer from './LedgerTransactionDrawer';

export default function LedgerTransactionsPage() {
  const { transactionId } = useParams();

  const navigate = useSearchPreservingNavigate();

  const [search, setSearch] = useQueryStates(ledgerTransactionSearchParams);

  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { hasPrevious, advancePage, revertPage } = useCursorPagination({
    after: search.after,
    onPageChange: (after) => {
      setSearch({ after });
    },
  });

  const canWrite = useCan(PermissionEnum.LEDGER_WRITE);

  const { data: ledgerTransactions, isPending } = useLedgerTransactionsQuery(
    { limit: PAGE_LIMIT, ...toQuery(search) },
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

  const handleOnCustomerIdChange = (customerId: string) => {
    setSearch(
      { customerId: isEmpty(customerId) ? null : customerId, after: null },
      { limitUrlUpdates: isEmpty(customerId) ? undefined : debounce(SEARCH_DEBOUNCE_MS) },
    );
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

      <DataTable
        toolbar={
          <FilterBar
            itemCount={size(rows)}
            searchValue={search.customerId}
            searchPlaceholder="Lọc theo customer id"
            onSearchChange={handleOnCustomerIdChange}
          />
        }
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
                <EntityCell
                  id={ledgerTransaction.id}
                  name={ledgerTransaction.description || undefined}
                />
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

      <EntityDrawer
        isOpen={isCreateOpen}
        title="Ghi bút toán"
        description="Tổng nợ phải bằng tổng có, nếu không sổ sẽ từ chối."
        onOpenChange={setIsCreateOpen}
      >
        <DrawerSection title="Bút toán">
          <LedgerTransactionForm form={form} isSaving={isSaving} onSave={handleOnSave} />
        </DrawerSection>
      </EntityDrawer>

      {transactionId ? (
        <LedgerTransactionDrawer transactionId={transactionId} onClose={handleOnCloseDetail} />
      ) : null}
    </PageCard>
  );
}
