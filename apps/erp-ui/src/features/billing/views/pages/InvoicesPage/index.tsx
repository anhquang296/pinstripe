import DataTable from '@common/components/DataTable';
import DrawerSection from '@common/components/DrawerSection';
import EntityCell from '@common/components/EntityCell';
import EntityDrawer from '@common/components/EntityDrawer';
import FilterBar from '@common/components/FilterBar';
import PageCard from '@common/components/PageCard';
import PageTabs from '@common/components/PageTabs';
import StatGrid from '@common/components/StatGrid';
import StatItem from '@common/components/StatItem';
import StatusChip from '@common/components/StatusChip';
import { OPTION_LIMIT, PAGE_LIMIT } from '@common/constants/pagination';
import { SEARCH_DEBOUNCE_MS } from '@common/constants/time';
import type { InvoiceFormData } from '@common/forms/invoice-form';
import {
  invoiceFormDataToPayload,
  invoiceFormDefaultValues,
  invoiceFormResolver,
} from '@common/forms/invoice-form';
import { useCursorPagination } from '@common/hooks/useCursorPagination';
import { useInvoiceStatusCounts } from '@common/hooks/useInvoiceStatusCounts';
import { useSearchPreservingNavigate } from '@common/hooks/useSearchPreservingNavigate';
import { toEnumMember } from '@common/utils/enum';
import { formatCurrency, formatDate } from '@common/utils/format';
import { toQuery } from '@common/utils/search-params';
import InvoiceForm from '@features/billing/components/InvoiceForm';
import { INVOICE_STATUS_TABS } from '@features/billing/constants/tabs';
import { billingPaths } from '@features/billing/routes/paths';
import { Button } from '@heroui/react';
import { useCan } from '@libs/permissions';
import type { InvoiceResponse } from '@vxrerp/billing/contracts';
import { CurrencyEnum, InvoiceStatusEnum } from '@vxrerp/billing/contracts';
import { PermissionEnum } from '@vxrerp/platform/contracts';
import {
  useCreateInvoiceMutation,
  useCustomersQuery,
  useInvoicesQuery,
  useSubscriptionsQuery,
} from '@vxrerp/sdk/react';
import { get, isEmpty, last, map, size, sumBy, toString } from 'lodash-es';
import { debounce, useQueryStates } from 'nuqs';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { generatePath, useParams } from 'react-router-dom';

import InvoiceDrawer from './InvoiceDrawer';
import { invoiceSearchParams, serializeInvoiceSearch } from './invoices.search-params';

export default function InvoicesPage() {
  const { status, invoiceId } = useParams();

  const navigate = useSearchPreservingNavigate();

  const [search, setSearch] = useQueryStates(invoiceSearchParams);

  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { hasPrevious, advancePage, revertPage } = useCursorPagination({
    after: search.after,
    onPageChange: (after) => {
      setSearch({ after });
    },
  });

  const canWrite = useCan(PermissionEnum.INVOICE_WRITE);

  const invoiceStatus = toEnumMember(InvoiceStatusEnum, toString(status), InvoiceStatusEnum.DRAFT);
  const statusCounts = useInvoiceStatusCounts();

  const { data: invoices, isPending } = useInvoicesQuery(
    { limit: PAGE_LIMIT, status: invoiceStatus, expand: ['customer'], ...toQuery(search) },
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

  const customerRows = get(customers, 'data', []);

  const customerOptions = [
    { value: '', label: '— không chọn —' },
    ...map(customerRows, (customer) => {
      return { value: customer.id, label: `${customer.name || customer.email} (${customer.id})` };
    }),
  ];

  const subscriptionOptions = [
    { value: '', label: '— không chọn —' },
    ...map(get(subscriptions, 'data', []), (subscription) => {
      return { value: subscription.id, label: `${subscription.id} · ${subscription.status}` };
    }),
  ];

  const tabSearch = serializeInvoiceSearch({ customerId: search.customerId, after: null });

  const tabs = map(INVOICE_STATUS_TABS, (tab) => {
    return {
      to: tab.to,
      search: tabSearch,
      label: `${tab.label} · ${statusCounts[tab.status]}`,
    };
  });

  const handleOnSave = form.handleSubmit(async (formData) => {
    await createInvoice(invoiceFormDataToPayload(formData));
    form.reset(invoiceFormDefaultValues);
    setIsCreateOpen(false);
  });

  const handleOnCustomerIdChange = (customerId: string) => {
    setSearch(
      { customerId: isEmpty(customerId) ? null : customerId, after: null },
      { limitUrlUpdates: isEmpty(customerId) ? undefined : debounce(SEARCH_DEBOUNCE_MS) },
    );
  };

  const handleOnNext = () => {
    const lastInvoice = last(rows);

    if (lastInvoice) {
      advancePage(lastInvoice.id);
    }
  };

  const handleOnRowAction = (invoice: InvoiceResponse) => {
    navigate(generatePath(billingPaths.INVOICE, { status: invoiceStatus, invoiceId: invoice.id }));
  };

  const handleOnCloseDetail = () => {
    navigate(generatePath(billingPaths.INVOICES_BY_STATUS, { status: invoiceStatus }));
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

      <DataTable
        toolbar={
          <FilterBar
            itemCount={size(rows)}
            searchValue={search.customerId}
            searchPlaceholder="Lọc theo customer id"
            onSearchChange={handleOnCustomerIdChange}
          />
        }
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
              return <EntityCell id={invoice.id} name={invoice.number || 'Chưa phát hành'} />;
            },
          },
          {
            key: 'customerId',
            label: 'Khách hàng',
            renderCell: (invoice) => {
              const customerName = get(invoice, 'customer.name', '');

              return <EntityCell id={invoice.customerId} name={customerName || undefined} />;
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

      <EntityDrawer
        isOpen={isCreateOpen}
        title="Tạo hoá đơn"
        description="Hoá đơn mới luôn bắt đầu ở trạng thái nháp."
        onOpenChange={setIsCreateOpen}
      >
        <DrawerSection title="Thông tin hoá đơn">
          <InvoiceForm
            form={form}
            customerOptions={customerOptions}
            subscriptionOptions={subscriptionOptions}
            isSaving={isSaving}
            onSave={handleOnSave}
          />
        </DrawerSection>
      </EntityDrawer>

      {invoiceId ? <InvoiceDrawer invoiceId={invoiceId} onClose={handleOnCloseDetail} /> : null}
    </PageCard>
  );
}
