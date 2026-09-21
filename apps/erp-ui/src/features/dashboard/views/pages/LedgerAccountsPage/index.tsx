import DataTable from '@common/components/DataTable';
import EntityCell from '@common/components/EntityCell';
import FilterBar from '@common/components/FilterBar';
import FilterSelect from '@common/components/FilterSelect';
import PageCard from '@common/components/PageCard';
import PageTabs from '@common/components/PageTabs';
import StatGrid from '@common/components/StatGrid';
import StatItem from '@common/components/StatItem';
import { OPTION_LIMIT, PAGE_LIMIT } from '@common/constants/pagination';
import { SEARCH_DEBOUNCE_MS } from '@common/constants/time';
import { useCursorPagination } from '@common/hooks/useCursorPagination';
import { useSearchPreservingNavigate } from '@common/hooks/useSearchPreservingNavigate';
import { formatCurrency } from '@common/utils/format';
import { toQuery } from '@common/utils/search-params';
import { LEDGER_TABS } from '@features/dashboard/constants/tabs';
import type { LedgerAccountResponse } from '@vxrerp/core/contracts';
import { CurrencyEnum, LedgerAccountCodeEnum } from '@vxrerp/core/contracts';
import { useCustomersQuery, useLedgerAccountsQuery } from '@vxrerp/sdk/react';
import { filter, fromPairs, get, isEmpty, isNull, last, map, size, sumBy, values } from 'lodash-es';
import { debounce, useQueryStates } from 'nuqs';
import { useParams } from 'react-router-dom';

import { ledgerAccountSearchParams } from './ledger-accounts.search-params';
import LedgerAccountDrawer from './LedgerAccountDrawer';

const CODE_OPTIONS = map(values(LedgerAccountCodeEnum), (accountCode) => {
  return { value: accountCode, label: accountCode };
});

export default function LedgerAccountsPage() {
  const { accountId } = useParams();

  const navigate = useSearchPreservingNavigate();

  const [search, setSearch] = useQueryStates(ledgerAccountSearchParams);

  const { hasPrevious, advancePage, revertPage } = useCursorPagination({
    after: search.after,
    onPageChange: (after) => {
      setSearch({ after });
    },
  });

  const { data: ledgerAccounts, isPending } = useLedgerAccountsQuery(
    { limit: PAGE_LIMIT, ...toQuery(search) },
    { hasPlaceholder: true },
  );

  const { data: customers } = useCustomersQuery({ limit: OPTION_LIMIT });

  const rows = get(ledgerAccounts, 'data', []);
  const hasMore = get(ledgerAccounts, 'hasMore', false);
  const currency = get(rows, '0.currency', CurrencyEnum.VND);

  const customerNameById = fromPairs(
    map(get(customers, 'data', []), (customer) => {
      return [customer.id, customer.name || customer.email];
    }),
  );

  const handleOnCodeSelect = (value: string | null) => {
    const code = isNull(value) ? null : ledgerAccountSearchParams.code.parse(value);

    setSearch({ code, after: null });
  };

  const handleOnCustomerIdChange = (customerId: string) => {
    setSearch(
      { customerId: isEmpty(customerId) ? null : customerId, after: null },
      { limitUrlUpdates: isEmpty(customerId) ? undefined : debounce(SEARCH_DEBOUNCE_MS) },
    );
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

      <DataTable
        toolbar={
          <FilterBar
            itemCount={size(rows)}
            searchValue={search.customerId}
            searchPlaceholder="Lọc theo customer id"
            onSearchChange={handleOnCustomerIdChange}
          >
            <FilterSelect
              label="Tài khoản"
              placeholder="Tất cả tài khoản"
              options={CODE_OPTIONS}
              selectedValue={search.code}
              onSelect={handleOnCodeSelect}
            />
          </FilterBar>
        }
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
              return <EntityCell id={ledgerAccount.id} name={ledgerAccount.code} />;
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
              if (!ledgerAccount.customerId) {
                return '—';
              }

              return get(customerNameById, ledgerAccount.customerId, ledgerAccount.customerId);
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

      {accountId ? (
        <LedgerAccountDrawer ledgerAccountId={accountId} onClose={handleOnCloseDetail} />
      ) : null}
    </PageCard>
  );
}
