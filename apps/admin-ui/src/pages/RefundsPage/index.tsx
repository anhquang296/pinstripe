import DataTable from '@components/DataTable';
import DrawerSection from '@components/DrawerSection';
import EntityDrawer from '@components/EntityDrawer';
import FilterBar from '@components/FilterBar';
import FilterSelect from '@components/FilterSelect';
import PageCard from '@components/PageCard';
import PageTabs from '@components/PageTabs';
import RefundForm from '@components/RefundForm';
import StatGrid from '@components/StatGrid';
import StatItem from '@components/StatItem';
import StatusChip from '@components/StatusChip';
import { OPTION_LIMIT, PAGE_LIMIT } from '@constants/pagination';
import { PAYMENT_TABS } from '@constants/tabs';
import type { RefundFormData } from '@forms/refund-form';
import {
  refundFormDataToPayload,
  refundFormDefaultValues,
  refundFormResolver,
} from '@forms/refund-form';
import { Button } from '@heroui/react';
import { useCursorPagination } from '@hooks/useCursorPagination';
import { toEnumMember } from '@lib/enum';
import { formatCurrency, formatDate } from '@lib/format';
import { useCan } from '@lib/permissions';
import type { RefundResponse } from '@pinstripe/core/contracts';
import { CurrencyEnum, PermissionEnum, RefundStatusEnum } from '@pinstripe/core/contracts';
import {
  useCreateRefundMutation,
  usePaymentIntentsQuery,
  useRefundsQuery,
} from '@pinstripe/sdk/react';
import { filter, flatMap, get, last, map, size, sumBy, values } from 'lodash-es';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';

import RefundDrawer from './RefundDrawer';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Tất cả trạng thái' },
  ...map(values(RefundStatusEnum), (status) => {
    return { value: status, label: status };
  }),
];

export default function RefundsPage() {
  const { refundId } = useParams();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchInvoiceId, setSearchInvoiceId] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { startingAfter, hasPrevious, advancePage, revertPage, resetPage } = useCursorPagination();
  const canRefund = useCan(PermissionEnum.REFUND_WRITE);

  const { data: refunds, isPending } = useRefundsQuery(
    {
      limit: PAGE_LIMIT,
      startingAfter,
      status:
        statusFilter === 'all'
          ? undefined
          : toEnumMember(RefundStatusEnum, statusFilter, RefundStatusEnum.SUCCEEDED),
      invoiceId: searchInvoiceId || undefined,
    },
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

  const handleOnStatusChange = (nextStatus: string) => {
    setStatusFilter(nextStatus);
    resetPage();
  };

  const handleOnSearchChange = (nextInvoiceId: string) => {
    setSearchInvoiceId(nextInvoiceId);
    resetPage();
  };

  const handleOnNext = () => {
    const lastRefund = last(rows);

    if (lastRefund) {
      advancePage(lastRefund.id);
    }
  };

  const handleOnRowAction = (refund: RefundResponse) => {
    navigate(`/payments/refunds/${refund.id}`);
  };

  const handleOnCloseDetail = () => {
    navigate('/payments/refunds');
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
              return (
                <div className="flex flex-col">
                  <span className="font-medium">{refund.id}</span>
                  <span className="text-app-label font-mono text-[11px]">{refund.chargeId}</span>
                </div>
              );
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
