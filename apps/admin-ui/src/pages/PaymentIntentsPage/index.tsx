import DataTable from '@components/DataTable';
import FilterBar from '@components/FilterBar';
import FilterSelect from '@components/FilterSelect';
import PageCard from '@components/PageCard';
import PageTabs from '@components/PageTabs';
import StatGrid from '@components/StatGrid';
import StatItem from '@components/StatItem';
import StatusChip from '@components/StatusChip';
import { PAGE_LIMIT } from '@constants/pagination';
import { PAYMENT_TABS } from '@constants/tabs';
import { useCursorPagination } from '@hooks/useCursorPagination';
import { toEnumMember } from '@lib/enum';
import { formatCurrency, formatDate } from '@lib/format';
import type { PaymentIntentResponse } from '@pinstripe/core/contracts';
import { CurrencyEnum, PaymentIntentStatusEnum } from '@pinstripe/core/contracts';
import { usePaymentIntentsQuery } from '@pinstripe/sdk/react';
import { filter, get, last, map, size, sumBy, values } from 'lodash-es';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import PaymentIntentDrawer from './PaymentIntentDrawer';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Tất cả trạng thái' },
  ...map(values(PaymentIntentStatusEnum), (status) => {
    return { value: status, label: status };
  }),
];

export default function PaymentIntentsPage() {
  const { paymentIntentId } = useParams();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchInvoiceId, setSearchInvoiceId] = useState('');
  const { startingAfter, hasPrevious, advancePage, revertPage, resetPage } = useCursorPagination();

  const { data: paymentIntents, isPending } = usePaymentIntentsQuery(
    {
      limit: PAGE_LIMIT,
      startingAfter,
      status:
        statusFilter === 'all'
          ? undefined
          : toEnumMember(PaymentIntentStatusEnum, statusFilter, PaymentIntentStatusEnum.SUCCEEDED),
      invoiceId: searchInvoiceId || undefined,
    },
    { hasPlaceholder: true },
  );

  const rows = get(paymentIntents, 'data', []);
  const hasMore = get(paymentIntents, 'hasMore', false);
  const currency = get(rows, '0.currency', CurrencyEnum.VND);

  const handleOnStatusChange = (nextStatus: string) => {
    setStatusFilter(nextStatus);
    resetPage();
  };

  const handleOnSearchChange = (nextInvoiceId: string) => {
    setSearchInvoiceId(nextInvoiceId);
    resetPage();
  };

  const handleOnNext = () => {
    const lastPaymentIntent = last(rows);

    if (lastPaymentIntent) {
      advancePage(lastPaymentIntent.id);
    }
  };

  const handleOnRowAction = (paymentIntent: PaymentIntentResponse) => {
    navigate(`/payments/intents/${paymentIntent.id}`);
  };

  const handleOnCloseDetail = () => {
    navigate('/payments/intents');
  };

  return (
    <PageCard
      title="Payments"
      description="PSP giả lập chạy trong tiến trình. Thẻ quyết định kết quả, và mọi lần thử đều được giữ lại."
      tabs={<PageTabs items={PAYMENT_TABS} />}
    >
      <StatGrid>
        <StatItem label="Intent trang này" value={size(rows)} />
        <StatItem
          label="Thành công"
          value={size(filter(rows, { status: PaymentIntentStatusEnum.SUCCEEDED }))}
        />
        <StatItem label="Tổng yêu cầu" value={formatCurrency(sumBy(rows, 'amount'), currency)} />
        <StatItem label="Đã nhận" value={formatCurrency(sumBy(rows, 'amountReceived'), currency)} />
      </StatGrid>

      <div className="border-app-border-soft flex flex-col rounded-md border bg-surface">
        <FilterBar
          itemCount={size(rows)}
          searchValue={searchInvoiceId}
          searchPlaceholder="Lọc theo invoice id"
          onSearchChange={handleOnSearchChange}
        >
          <FilterSelect
            label="Trạng thái"
            options={STATUS_OPTIONS}
            selectedValue={statusFilter}
            onSelect={handleOnStatusChange}
          />
        </FilterBar>

        <DataTable
          label="Danh sách payment intent"
          rows={rows}
          isLoading={isPending}
          hasMore={hasMore}
          hasPrevious={hasPrevious}
          emptyMessage="Chưa có payment intent nào."
          onRowAction={handleOnRowAction}
          onNext={handleOnNext}
          onPrevious={revertPage}
          columns={[
            {
              key: 'id',
              label: 'Payment intent',
              isRowHeader: true,
              renderCell: (paymentIntent) => {
                return (
                  <div className="flex flex-col">
                    <span className="font-medium">{paymentIntent.id}</span>
                    <span className="text-app-label font-mono text-[11px]">
                      {paymentIntent.customerId}
                    </span>
                  </div>
                );
              },
            },
            {
              key: 'status',
              label: 'Trạng thái',
              renderCell: (paymentIntent) => {
                return <StatusChip status={paymentIntent.status} />;
              },
            },
            {
              key: 'invoiceId',
              label: 'Hoá đơn',
              renderCell: (paymentIntent) => {
                return paymentIntent.invoiceId ?? '—';
              },
            },
            {
              key: 'amount',
              label: 'Số tiền',
              renderCell: (paymentIntent) => {
                return formatCurrency(paymentIntent.amount, paymentIntent.currency);
              },
            },
            {
              key: 'charges',
              label: 'Lần thử',
              renderCell: (paymentIntent) => {
                return size(paymentIntent.charges);
              },
            },
            {
              key: 'createdAt',
              label: 'Tạo lúc',
              renderCell: (paymentIntent) => {
                return formatDate(paymentIntent.createdAt);
              },
            },
          ]}
        />
      </div>

      {paymentIntentId ? (
        <PaymentIntentDrawer paymentIntentId={paymentIntentId} onClose={handleOnCloseDetail} />
      ) : null}
    </PageCard>
  );
}
