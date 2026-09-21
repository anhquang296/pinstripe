import DataTable from '@common/components/DataTable';
import DrawerSection from '@common/components/DrawerSection';
import EntityCell from '@common/components/EntityCell';
import EntityDrawer from '@common/components/EntityDrawer';
import FilterBar from '@common/components/FilterBar';
import FilterSelect from '@common/components/FilterSelect';
import PageCard from '@common/components/PageCard';
import PageTabs from '@common/components/PageTabs';
import StatGrid from '@common/components/StatGrid';
import StatItem from '@common/components/StatItem';
import StatusChip from '@common/components/StatusChip';
import { OPTION_LIMIT, PAGE_LIMIT } from '@common/constants/pagination';
import { SEARCH_DEBOUNCE_MS } from '@common/constants/time';
import type { RefundFormData } from '@common/forms/refund-form';
import {
  refundFormDataToPayload,
  refundFormDefaultValues,
  refundFormResolver,
} from '@common/forms/refund-form';
import { useCursorPagination } from '@common/hooks/useCursorPagination';
import { useSearchPreservingNavigate } from '@common/hooks/useSearchPreservingNavigate';
import { formatCurrency, formatDate } from '@common/utils/format';
import { toQuery } from '@common/utils/search-params';
import RefundForm from '@features/billing/components/RefundForm';
import { PAYMENT_TABS } from '@features/billing/constants/tabs';
import { billingPaths } from '@features/billing/routes/paths';
import { Button } from '@heroui/react';
import { useCan } from '@libs/permissions';
import type { RefundResponse } from '@vxrerp/billing/contracts';
import { CurrencyEnum, RefundStatusEnum } from '@vxrerp/billing/contracts';
import { PermissionEnum } from '@vxrerp/platform/contracts';
import {
  useCreateRefundMutation,
  usePaymentIntentsQuery,
  useRefundsQuery,
} from '@vxrerp/sdk/react';
import { filter, flatMap, get, isEmpty, isNull, last, map, size, sumBy, values } from 'lodash-es';
import { debounce, useQueryStates } from 'nuqs';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { generatePath, useParams } from 'react-router-dom';

import RefundDrawer from './RefundDrawer';
import { refundSearchParams } from './refunds.search-params';

const STATUS_OPTIONS = map(values(RefundStatusEnum), (status) => {
  return { value: status, label: status };
});

export default function RefundsPage() {
  const { refundId } = useParams();

  const navigate = useSearchPreservingNavigate();

  const [search, setSearch] = useQueryStates(refundSearchParams);

  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { hasPrevious, advancePage, revertPage } = useCursorPagination({
    after: search.after,
    onPageChange: (after) => {
      setSearch({ after });
    },
  });

  const canRefund = useCan(PermissionEnum.REFUND_WRITE);

  const { data: refunds, isPending } = useRefundsQuery(
    { limit: PAGE_LIMIT, ...toQuery(search) },
    { hasPlaceholder: true },
  );

  const { data: paymentIntents } = usePaymentIntentsQuery({ limit: OPTION_LIMIT });

  const { mutateAsync: createRefund, isPending: isSaving } = useCreateRefundMutation({
    successMessage: 'Đã hoàn tiền.',
  });

  const form = useForm<RefundFormData>({
    resolver: refundFormResolver,
    defaultValues: refundFormDefaultValues,
  });

  const rows = get(refunds, 'data', []);
  const hasMore = get(refunds, 'hasMore', false);
  const currency = get(rows, '0.currency', CurrencyEnum.VND);

  const chargeOptions = [
    { value: '', label: '— chọn charge —' },
    ...flatMap(get(paymentIntents, 'data', []), (paymentIntent) => {
      return map(paymentIntent.charges, (charge) => {
        return {
          value: charge.id,
          label: `${charge.id} · ${formatCurrency(charge.amount, charge.currency)}`,
        };
      });
    }),
  ];

  const handleOnSave = form.handleSubmit(async (formData) => {
    await createRefund(refundFormDataToPayload(formData));
    form.reset(refundFormDefaultValues);
    setIsCreateOpen(false);
  });

  const handleOnStatusSelect = (value: string | null) => {
    const status = isNull(value) ? null : refundSearchParams.status.parse(value);

    setSearch({ status, after: null });
  };

  const handleOnInvoiceIdChange = (invoiceId: string) => {
    setSearch(
      { invoiceId: isEmpty(invoiceId) ? null : invoiceId, after: null },
      { limitUrlUpdates: isEmpty(invoiceId) ? undefined : debounce(SEARCH_DEBOUNCE_MS) },
    );
  };

  const handleOnNext = () => {
    const lastRefund = last(rows);

    if (lastRefund) {
      advancePage(lastRefund.id);
    }
  };

  const handleOnRowAction = (refund: RefundResponse) => {
    navigate(generatePath(billingPaths.PAYMENTS_REFUND, { refundId: refund.id }));
  };

  const handleOnCloseDetail = () => {
    navigate(billingPaths.PAYMENTS_REFUNDS);
  };

  return (
    <PageCard
      title="Payments"
      description="Hoàn tiền luôn bám vào một charge đã thu. Sổ cái ghi nhận ngay khi PSP xác nhận."
      tabs={<PageTabs items={PAYMENT_TABS} />}
      actions={
        canRefund ? (
          <Button
            onPress={() => {
              setIsCreateOpen(true);
            }}
          >
            Tạo refund
          </Button>
        ) : null
      }
    >
      <StatGrid>
        <StatItem label="Refund trang này" value={size(rows)} />
        <StatItem
          label="Thành công"
          value={size(filter(rows, { status: RefundStatusEnum.SUCCEEDED }))}
        />
        <StatItem
          label="Đang chờ"
          value={size(filter(rows, { status: RefundStatusEnum.PENDING }))}
        />
        <StatItem label="Tổng hoàn" value={formatCurrency(sumBy(rows, 'amount'), currency)} />
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
        label="Danh sách refund"
        rows={rows}
        isLoading={isPending}
        hasMore={hasMore}
        hasPrevious={hasPrevious}
        emptyMessage="Chưa có refund nào."
        onRowAction={handleOnRowAction}
        onNext={handleOnNext}
        onPrevious={revertPage}
        columns={[
          {
            key: 'id',
            label: 'Refund',
            isRowHeader: true,
            renderCell: (refund) => {
              return <EntityCell id={refund.id} />;
            },
          },
          {
            key: 'chargeId',
            label: 'Charge',
            renderCell: (refund) => {
              return <EntityCell id={refund.chargeId} />;
            },
          },
          {
            key: 'status',
            label: 'Trạng thái',
            renderCell: (refund) => {
              return <StatusChip status={refund.status} />;
            },
          },
          {
            key: 'invoiceId',
            label: 'Hoá đơn',
            renderCell: (refund) => {
              return refund.invoiceId ?? '—';
            },
          },
          {
            key: 'amount',
            label: 'Số tiền',
            renderCell: (refund) => {
              return formatCurrency(refund.amount, refund.currency);
            },
          },
          {
            key: 'reason',
            label: 'Lý do',
            renderCell: (refund) => {
              return refund.reason;
            },
          },
          {
            key: 'createdAt',
            label: 'Tạo lúc',
            renderCell: (refund) => {
              return formatDate(refund.createdAt);
            },
          },
        ]}
      />

      <EntityDrawer
        isOpen={isCreateOpen}
        title="Tạo refund"
        description="Hoàn tiền theo charge, số tiền không vượt quá phần đã thu."
        onOpenChange={setIsCreateOpen}
      >
        <DrawerSection title="Thông tin refund">
          <RefundForm
            form={form}
            chargeOptions={chargeOptions}
            isSaving={isSaving}
            onSave={handleOnSave}
          />
        </DrawerSection>
      </EntityDrawer>

      {refundId ? <RefundDrawer refundId={refundId} onClose={handleOnCloseDetail} /> : null}
    </PageCard>
  );
}
