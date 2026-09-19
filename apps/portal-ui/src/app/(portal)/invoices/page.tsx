'use client';

import PageCard from '@common/components/PageCard';
import { useCursorPagination } from '@common/hooks/useCursorPagination';
import InvoicesTable from '@features/portal/components/InvoicesTable';
import { buttonVariants, Tabs } from '@heroui/react';
import { InvoiceStatusEnum } from '@pinstripe/core/contracts';
import type { FindPortalInvoicesQuery, InvoiceResponse } from '@pinstripe/sdk';
import { usePortalInvoicesQuery } from '@pinstripe/sdk/react/portal';
import { find, get, last, map, mapValues, toString } from 'lodash-es';
import { useRouter } from 'next/navigation';
import type { Key } from 'react';
import { use } from 'react';

interface InvoicesPageProps {
  searchParams: Promise<{ view?: string | string[] }>;
}

interface InvoiceView {
  key: string;
  label: string;
  query: FindPortalInvoicesQuery;
  emptyMessage: string;
}

const PAGE_LIMIT = 20;
const ALL_INVOICES_VIEW: InvoiceView = {
  key: 'all',
  label: 'Tất cả',
  query: {},
  emptyMessage: 'Chưa có hóa đơn nào.',
};
const INVOICE_VIEWS: InvoiceView[] = [
  ALL_INVOICES_VIEW,
  {
    key: 'upcoming',
    label: 'Chưa đến hạn',
    query: { isOverdue: false },
    emptyMessage: 'Không có hóa đơn nào đang chờ thanh toán.',
  },
  {
    key: 'overdue',
    label: 'Quá hạn',
    query: { isOverdue: true },
    emptyMessage: 'Không có hóa đơn quá hạn.',
  },
  {
    key: 'paid',
    label: 'Đã thanh toán',
    query: { status: InvoiceStatusEnum.PAID },
    emptyMessage: 'Chưa có hóa đơn nào đã thanh toán.',
  },
];

export default function InvoicesPage({ searchParams }: InvoicesPageProps) {
  const { view } = use(searchParams);
  const router = useRouter();
  const { startingAfter, hasPrevious, advancePage, revertPage, resetPage } = useCursorPagination();
  const activeView = find(INVOICE_VIEWS, { key: toString(view) }) || ALL_INVOICES_VIEW;
  const { data: invoices, isPending } = usePortalInvoicesQuery(
    { ...activeView.query, limit: PAGE_LIMIT, startingAfter },
    { hasPlaceholder: true },
  );
  const invoiceRows = get(invoices, 'data', []);
  const exportSearch = new URLSearchParams(mapValues(activeView.query, toString)).toString();
  const exportUrl = `/bff/portal/invoice_exports?${exportSearch}`;

  const handleOnViewChange = (key: Key) => {
    resetPage();
    router.replace(`/invoices?view=${toString(key)}`);
  };

  const handleOnInvoiceSelect = (invoice: InvoiceResponse) => {
    router.push(`/invoices/${invoice.id}`);
  };

  const handleOnNext = () => {
    const lastInvoice = last(invoiceRows);

    if (lastInvoice) {
      advancePage(lastInvoice.id);
    }
  };

  return (
    <PageCard
      title="Hóa đơn"
      description="Tra cứu hóa đơn theo trạng thái và tải bản PDF."
      actions={
        <a className={buttonVariants({ variant: 'secondary' })} href={exportUrl} download>
          Xuất Excel (CSV)
        </a>
      }
    >
      <Tabs className="w-fit" selectedKey={activeView.key} onSelectionChange={handleOnViewChange}>
        <Tabs.ListContainer>
          <Tabs.List aria-label="Lọc hóa đơn">
            {map(INVOICE_VIEWS, (invoiceView) => {
              return (
                <Tabs.Tab key={invoiceView.key} id={invoiceView.key}>
                  {invoiceView.label}
                  <Tabs.Indicator />
                </Tabs.Tab>
              );
            })}
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>

      <InvoicesTable
        invoices={invoiceRows}
        isLoading={isPending}
        emptyMessage={activeView.emptyMessage}
        hasMore={get(invoices, 'hasMore', false)}
        hasPrevious={hasPrevious}
        onInvoiceSelect={handleOnInvoiceSelect}
        onNext={handleOnNext}
        onPrevious={revertPage}
      />
    </PageCard>
  );
}
