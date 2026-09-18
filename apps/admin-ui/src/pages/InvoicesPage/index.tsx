import DataTable from '@components/DataTable';
import EntityDrawer from '@components/EntityDrawer';
import FilterBar from '@components/FilterBar';
import InvoiceForm from '@components/InvoiceForm';
import PageCard from '@components/PageCard';
import PageTabs from '@components/PageTabs';
import StatGrid from '@components/StatGrid';
import StatItem from '@components/StatItem';
import StatusChip from '@components/StatusChip';
import { OPTION_LIMIT, PAGE_LIMIT } from '@constants/pagination';
import { INVOICE_STATUS_TABS } from '@constants/tabs';
import type { InvoiceFormData } from '@forms/invoice-form';
import {
  invoiceFormDataToPayload,
  invoiceFormDefaultValues,
  invoiceFormResolver,
} from '@forms/invoice-form';
import { Button } from '@heroui/react';
import { useCursorPagination } from '@hooks/useCursorPagination';
import { useInvoiceStatusCounts } from '@hooks/useInvoiceStatusCounts';
import { toEnumMember } from '@lib/enum';
import { formatCurrency, formatDate } from '@lib/format';
import { useCan } from '@lib/permissions';
import type { InvoiceResponse } from '@pinstripe/core/contracts';
import { CurrencyEnum, InvoiceStatusEnum, PermissionEnum } from '@pinstripe/core/contracts';
import {
  useCreateInvoiceMutation,
  useCustomersQuery,
  useInvoicesQuery,
  useSubscriptionsQuery,
} from '@pinstripe/sdk/react';
import { get, last, map, size, sumBy, toString } from 'lodash-es';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';

import InvoiceDrawer from './InvoiceDrawer';

export default function InvoicesPage() {
  const { status, invoiceId } = useParams();
  const navigate = useNavigate();
  const [searchCustomerId, setSearchCustomerId] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { startingAfter, hasPrevious, advancePage, revertPage, resetPage } = useCursorPagination();
  const canWrite = useCan(PermissionEnum.INVOICE_WRITE);

  const invoiceStatus = toEnumMember(InvoiceStatusEnum, toString(status), InvoiceStatusEnum.DRAFT);
  const statusCounts = useInvoiceStatusCounts();

  const { data: invoices, isPending } = useInvoicesQuery(
    {
      limit: PAGE_LIMIT,
      startingAfter,
      status: invoiceStatus,
      customerId: searchCustomerId || undefined,
    },
    { hasPlaceholder: true },
  );
  const { data: customers } = useCustomersQuery({ limit: OPTION_LIMIT });
  const { data: subscriptions } = useSubscriptionsQuery({ limit: OPTION_LIMIT });

  const { mutateAsync: createInvoice, isPending: isSaving } = useCreateInvoiceMutation({
    successMessage: 'Đã tạo hoá đơn nháp.',
  });

  const form = useForm<InvoiceFormData>({
    resolver: invoiceFormResolver,
    defaultValues: invoiceFormDefaultValues,
  });

  const rows = get(invoices, 'data', []);
  const hasMore = get(invoices, 'hasMore', false);
  const currency = get(rows, '0.currency', CurrencyEnum.VND);

  const customerOptions = [
    { value: '', label: '— không chọn —' },
    ...map(get(customers, 'data', []), (customer) => {
      return { value: customer.id, label: `${customer.name || customer.email} (${customer.id})` };
    }),
  ];
  const subscriptionOptions = [
    { value: '', label: '— không chọn —' },
    ...map(get(subscriptions, 'data', []), (subscription) => {
      return { value: subscription.id, label: `${subscription.id} · ${subscription.status}` };
    }),
  ];

  const tabs = map(INVOICE_STATUS_TABS, (tab) => {
    return { to: tab.to, label: `${tab.label} · ${statusCounts[tab.status]}` };
  });

  const handleOnSave = form.handleSubmit(async (formData) => {
    await createInvoice(invoiceFormDataToPayload(formData));
    form.reset(invoiceFormDefaultValues);
    setIsCreateOpen(false);
  });

  const handleOnSearchChange = (nextCustomerId: string) => {
    setSearchCustomerId(nextCustomerId);
    resetPage();
  };

  const handleOnNext = () => {
    const lastInvoice = last(rows);

    if (lastInvoice) {
      advancePage(lastInvoice.id);
    }
  };

  const handleOnRowAction = (invoice: InvoiceResponse) => {
    navigate(`/invoices/${invoiceStatus}/${invoice.id}`);
  };

  const handleOnCloseDetail = () => {
    navigate(`/invoices/${invoiceStatus}`);
  };

  return (
    <PageCard
      title="Invoices"
      description="Nháp còn sửa được. Phát hành rồi thì số và số tiền đóng băng — sai thì ra credit note, không sửa ngược."
      tabs={<PageTabs items={tabs} />}
      actions={
        canWrite ? (
          <Button
            onPress={() => {
              setIsCreateOpen(true);
            }}
          >
            Tạo hoá đơn
          </Button>
        ) : null
      }
    >
      <StatGrid>
        <StatItem label="Hoá đơn trang này" value={size(rows)} />
        <StatItem label="Tổng phát hành" value={formatCurrency(sumBy(rows, 'total'), currency)} />
        <StatItem label="Đã thu" value={formatCurrency(sumBy(rows, 'amountPaid'), currency)} />
        <StatItem
          label="Còn phải thu"
          value={formatCurrency(sumBy(rows, 'amountRemaining'), currency)}
        />
      </StatGrid>

      <div className="border-app-border-soft flex flex-col rounded-md border bg-surface">
        <FilterBar
          itemCount={size(rows)}
          searchValue={searchCustomerId}
          searchPlaceholder="Lọc theo customer id"
          onSearchChange={handleOnSearchChange}
        />

        <DataTable
          label="Danh sách hoá đơn"
          rows={rows}
          isLoading={isPending}
          hasMore={hasMore}
          hasPrevious={hasPrevious}
          emptyMessage="Chưa có hoá đơn ở trạng thái này."
          onRowAction={handleOnRowAction}
          onNext={handleOnNext}
          onPrevious={revertPage}
          columns={[
            {
              key: 'number',
              label: 'Số hoá đơn',
              isRowHeader: true,
              renderCell: (invoice) => {
                return (
                  <div className="flex flex-col">
                    <span className="font-medium">{invoice.number || 'Chưa phát hành'}</span>
                    <span className="text-app-label font-mono text-[11px]">{invoice.id}</span>
                  </div>
                );
              },
            },
            {
              key: 'customerId',
              label: 'Khách hàng',
              renderCell: (invoice) => {
                return <span className="font-mono text-[11px]">{invoice.customerId}</span>;
              },
            },
            {
              key: 'status',
              label: 'Trạng thái',
              renderCell: (invoice) => {
                return <StatusChip status={invoice.status} />;
              },
            },
            {
              key: 'total',
              label: 'Tổng',
              renderCell: (invoice) => {
                return formatCurrency(invoice.total, invoice.currency);
              },
            },
            {
              key: 'amountPaid',
              label: 'Đã trả',
              renderCell: (invoice) => {
                return formatCurrency(invoice.amountPaid, invoice.currency);
              },
            },
            {
              key: 'amountRemaining',
              label: 'Còn lại',
              renderCell: (invoice) => {
                return formatCurrency(invoice.amountRemaining, invoice.currency);
              },
            },
            {
              key: 'createdAt',
              label: 'Tạo lúc',
              renderCell: (invoice) => {
                return formatDate(invoice.createdAt);
              },
            },
          ]}
        />
      </div>

      <EntityDrawer
        isOpen={isCreateOpen}
        title="Tạo hoá đơn"
        description="Hoá đơn mới luôn bắt đầu ở trạng thái nháp."
        onOpenChange={setIsCreateOpen}
      >
        <InvoiceForm
          form={form}
          customerOptions={customerOptions}
          subscriptionOptions={subscriptionOptions}
          isSaving={isSaving}
          onSave={handleOnSave}
        />
      </EntityDrawer>

      {invoiceId ? <InvoiceDrawer invoiceId={invoiceId} onClose={handleOnCloseDetail} /> : null}
    </PageCard>
  );
}
