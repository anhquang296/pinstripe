import DataTable from '@components/DataTable';
import FilterBar from '@components/FilterBar';
import FilterSelect from '@components/FilterSelect';
import PageCard from '@components/PageCard';
import PageTabs from '@components/PageTabs';
import StatGrid from '@components/StatGrid';
import StatItem from '@components/StatItem';
import { PAGE_LIMIT } from '@constants/pagination';
import { LEDGER_TABS } from '@constants/tabs';
import { useCursorPagination } from '@hooks/useCursorPagination';
import { toEnumMember } from '@lib/enum';
import { formatCurrency } from '@lib/format';
import type { LedgerAccountResponse } from '@pinstripe/core/contracts';
import { CurrencyEnum, LedgerAccountCodeEnum } from '@pinstripe/core/contracts';
import { useLedgerAccountsQuery } from '@pinstripe/sdk/react';
import { filter, get, last, map, size, sumBy, values } from 'lodash-es';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import LedgerAccountDrawer from './LedgerAccountDrawer';

const CODE_OPTIONS = [
  { value: 'all', label: 'Tất cả tài khoản' },
  ...map(values(LedgerAccountCodeEnum), (accountCode) => {
    return { value: accountCode, label: accountCode };
  }),
];

export default function LedgerAccountsPage() {
  const { accountId } = useParams();
  const navigate = useNavigate();
  const [codeFilter, setCodeFilter] = useState('all');
  const [searchCustomerId, setSearchCustomerId] = useState('');
  const { startingAfter, hasPrevious, advancePage, revertPage, resetPage } = useCursorPagination();

  const { data: ledgerAccounts, isPending } = useLedgerAccountsQuery(
    {
      limit: PAGE_LIMIT,
      startingAfter,
      code:
        codeFilter === 'all'
          ? undefined
          : toEnumMember(LedgerAccountCodeEnum, codeFilter, LedgerAccountCodeEnum.CASH),
      customerId: searchCustomerId || undefined,
    },
    { hasPlaceholder: true },
  );

  const rows = get(ledgerAccounts, 'data', []);
  const hasMore = get(ledgerAccounts, 'hasMore', false);
  const currency = get(rows, '0.currency', CurrencyEnum.VND);

  const handleOnCodeChange = (nextCode: string) => {
    setCodeFilter(nextCode);
    resetPage();
  };

  const handleOnSearchChange = (nextCustomerId: string) => {
    setSearchCustomerId(nextCustomerId);
    resetPage();
  };

  const handleOnNext = () => {
    const lastAccount = last(rows);

    if (lastAccount) {
      advancePage(lastAccount.id);
    }
  };

  const handleOnRowAction = (ledgerAccount: LedgerAccountResponse) => {
    navigate(`/ledger/accounts/${ledgerAccount.id}`);
  };

  const handleOnCloseDetail = () => {
    navigate('/ledger/accounts');
  };

  return (
    <PageCard
      title="Ledger"
      description="Sổ kép append-only: số dư là projection của postings, sửa sai bằng bút toán đảo."
      tabs={<PageTabs items={LEDGER_TABS} />}
    >
      <StatGrid>
        <StatItem label="Tài khoản trang này" value={size(rows)} />
        <StatItem label="Tổng nợ" value={formatCurrency(sumBy(rows, 'debits'), currency)} />
        <StatItem label="Tổng có" value={formatCurrency(sumBy(rows, 'credits'), currency)} />
        <StatItem label="Tài khoản theo khách" value={size(filter(rows, 'customerId'))} />
      </StatGrid>

      <div className="border-app-border-soft flex flex-col rounded-md border bg-surface">
        <FilterBar
          itemCount={size(rows)}
          searchValue={searchCustomerId}
          searchPlaceholder="Lọc theo customer id"
          onSearchChange={handleOnSearchChange}
        >
          <FilterSelect
            label="Tài khoản"
            options={CODE_OPTIONS}
            selectedValue={codeFilter}
            onSelect={handleOnCodeChange}
          />
        </FilterBar>

        <DataTable
          label="Số dư tài khoản"
          rows={rows}
          isLoading={isPending}
          hasMore={hasMore}
          hasPrevious={hasPrevious}
          emptyMessage="Chưa có tài khoản nào."
          onRowAction={handleOnRowAction}
          onNext={handleOnNext}
          onPrevious={revertPage}
          columns={[
            {
              key: 'code',
              label: 'Tài khoản',
              isRowHeader: true,
              renderCell: (ledgerAccount) => {
                return (
                  <div className="flex flex-col">
                    <span className="font-medium">{ledgerAccount.code}</span>
                    <span className="text-app-label font-mono text-[11px]">{ledgerAccount.id}</span>
                  </div>
                );
              },
            },
            {
              key: 'type',
              label: 'Loại',
              renderCell: (ledgerAccount) => {
                return ledgerAccount.type;
              },
            },
            {
              key: 'customerId',
              label: 'Khách hàng',
              renderCell: (ledgerAccount) => {
                return ledgerAccount.customerId ?? '—';
              },
            },
            {
              key: 'debits',
              label: 'Nợ',
              renderCell: (ledgerAccount) => {
                return formatCurrency(ledgerAccount.debits, ledgerAccount.currency);
              },
            },
            {
              key: 'credits',
              label: 'Có',
              renderCell: (ledgerAccount) => {
                return formatCurrency(ledgerAccount.credits, ledgerAccount.currency);
              },
            },
            {
              key: 'balance',
              label: 'Số dư',
              renderCell: (ledgerAccount) => {
                return formatCurrency(ledgerAccount.balance, ledgerAccount.currency);
              },
            },
          ]}
        />
      </div>

      {accountId ? (
        <LedgerAccountDrawer ledgerAccountId={accountId} onClose={handleOnCloseDetail} />
      ) : null}
    </PageCard>
  );
}
