import DataTable from '@common/components/DataTable';
import EntityCell from '@common/components/EntityCell';
import FilterBar from '@common/components/FilterBar';
import FilterSelect from '@common/components/FilterSelect';
import PageCard from '@common/components/PageCard';
import PageTabs from '@common/components/PageTabs';
import StatGrid from '@common/components/StatGrid';
import StatItem from '@common/components/StatItem';
import StatusChip from '@common/components/StatusChip';
import { PAGE_LIMIT } from '@common/constants/pagination';
import { SEARCH_DEBOUNCE_MS } from '@common/constants/time';
import { useCursorPagination } from '@common/hooks/useCursorPagination';
import { useSearchPreservingNavigate } from '@common/hooks/useSearchPreservingNavigate';
import { formatCurrency, formatDate } from '@common/utils/format';
import { toQuery } from '@common/utils/search-params';
import { PAYMENT_TABS } from '@features/dashboard/constants/tabs';
import type { PaymentIntentResponse } from '@vxrerp/billing/contracts';
import { CurrencyEnum, PaymentIntentStatusEnum } from '@vxrerp/billing/contracts';
import { usePaymentIntentsQuery } from '@vxrerp/sdk/react';
import { filter, get, isEmpty, isNull, last, map, size, sumBy, values } from 'lodash-es';
import { debounce, useQueryStates } from 'nuqs';
import { useParams } from 'react-router-dom';

import { paymentIntentSearchParams } from './payment-intents.search-params';
import PaymentIntentDrawer from './PaymentIntentDrawer';

const STATUS_OPTIONS = map(values(PaymentIntentStatusEnum), (status) => {
  return { value: status, label: status };
});

export default function PaymentIntentsPage() {
  const { paymentIntentId } = useParams();

  const navigate = useSearchPreservingNavigate();

  const [search, setSearch] = useQueryStates(paymentIntentSearchParams);

  const { hasPrevious, advancePage, revertPage } = useCursorPagination({
    after: search.after,
    onPageChange: (after) => {
      setSearch({ after });
    },
  });

  const { data: paymentIntents, isPending } = usePaymentIntentsQuery(
    { limit: PAGE_LIMIT, expand: ['customer'], ...toQuery(search) },
    { hasPlaceholder: true },
  );

  const rows = get(paymentIntents, 'data', []);
  const hasMore = get(paymentIntents, 'hasMore', false);
  const currency = get(rows, '0.currency', CurrencyEnum.VND);

  const handleOnStatusSelect = (value: string | null) => {
    const status = isNull(value) ? null : paymentIntentSearchParams.status.parse(value);

    setSearch({ status, after: null });
  };

  const handleOnInvoiceIdChange = (invoiceId: string) => {
    setSearch(
      { invoiceId: isEmpty(invoiceId) ? null : invoiceId, after: null },
      { limitUrlUpdates: isEmpty(invoiceId) ? undefined : debounce(SEARCH_DEBOUNCE_MS) },
    );
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

      <DataTable
        toolbar={
          <FilterBar
            itemCount={size(rows)}
            searchValue={search.invoiceId}
            searchPlaceholder="Lọc theo invoice id"
            onSearchChange={handleOnInvoiceIdChange}
          >
            <FilterSelect
              label="Trạng thái"
              placeholder="Tất cả trạng thái"
              options={STATUS_OPTIONS}
              selectedValue={search.status}
              onSelect={handleOnStatusSelect}
            />
          </FilterBar>
        }
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
              return <EntityCell id={paymentIntent.id} />;
            },
          },
          {
            key: 'customerId',
            label: 'Khách hàng',
            renderCell: (paymentIntent) => {
              const customerName = get(paymentIntent, 'customer.name', '');

              return <EntityCell id={paymentIntent.customerId} name={customerName || undefined} />;
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

      {paymentIntentId ? (
        <PaymentIntentDrawer paymentIntentId={paymentIntentId} onClose={handleOnCloseDetail} />
      ) : null}
    </PageCard>
  );
}
