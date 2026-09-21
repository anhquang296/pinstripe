import DataTable from '@common/components/DataTable';
import DetailList from '@common/components/DetailList';
import DrawerSection from '@common/components/DrawerSection';
import PageCard from '@common/components/PageCard';
import StatGrid from '@common/components/StatGrid';
import StatItem from '@common/components/StatItem';
import StatusChip from '@common/components/StatusChip';
import { useReportRangeLabel, useReportWindow } from '@common/hooks/useReportWindow';
import { formatCurrency, formatDate } from '@common/utils/format';
import { CurrencyEnum } from '@vxrerp/billing/contracts';
import { useReconciliationReportQuery, useRevenueSummaryQuery } from '@vxrerp/sdk/react';
import { get, isNil, map, size } from 'lodash-es';

function formatExceptionAmount(amount: number | null, currency: string): string {
  if (isNil(amount)) {
    return '—';
  }

  return formatCurrency(amount, currency);
}

export default function ReportsPage() {
  const reportWindow = useReportWindow();
  const rangeLabel = useReportRangeLabel();

  const { data: revenue } = useRevenueSummaryQuery(reportWindow);

  const { data: reconciliation, isPending } = useReconciliationReportQuery(reportWindow);

  const currency = get(revenue, 'currency', CurrencyEnum.VND);

  const exceptions = map(get(reconciliation, 'exceptions', []), (exception) => {
    return { ...exception, id: `${exception.source}:${exception.reference}` };
  });

  return (
    <PageCard
      title="Reports"
      description="MRR quy về tháng từ gói đang chạy. Đối soát so tiền cổng thanh toán với tiền mặt trên sổ — lệch thì hiện ở đây, không im lặng."
    >
      <StatGrid>
        <StatItem
          label="MRR"
          value={formatCurrency(get(revenue, 'mrr', 0), currency)}
          meta={`ARR ${formatCurrency(get(revenue, 'arr', 0), currency)}`}
        />
        <StatItem
          label="Thuê bao đang chạy"
          value={get(revenue, 'activeSubscriptions', 0)}
          meta={`Dùng thử ${get(revenue, 'trialingSubscriptions', 0)}`}
        />
        <StatItem
          label="Churn trong kỳ"
          value={`${(get(revenue, 'churnRate', 0) * 100).toFixed(2)}%`}
          meta={`Huỷ ${get(revenue, 'canceledInWindow', 0)}`}
        />
        <StatItem
          label="Còn phải thu"
          value={formatCurrency(get(revenue, 'outstanding', 0), currency)}
          meta={`Đã thu ${formatCurrency(get(revenue, 'collectedInWindow', 0), currency)}`}
        />
      </StatGrid>

      <DrawerSection title={`Đối soát — ${rangeLabel}`}>
        <DetailList
          items={[
            {
              label: 'Cổng thanh toán',
              value: formatCurrency(get(reconciliation, 'processorTotal', 0), currency),
            },
            {
              label: 'Sổ cái',
              value: formatCurrency(get(reconciliation, 'ledgerTotal', 0), currency),
            },
            {
              label: 'Hoá đơn',
              value: formatCurrency(get(reconciliation, 'invoiceTotal', 0), currency),
            },
            {
              label: 'Chênh lệch',
              value: formatCurrency(get(reconciliation, 'difference', 0), currency),
            },
            { label: 'Đã quét', value: get(reconciliation, 'scanned', 0) },
            { label: 'Khớp', value: get(reconciliation, 'matched', 0) },
            { label: 'Từ ngày', value: formatDate(get(reconciliation, 'windowStart', '')) },
            { label: 'Đến ngày', value: formatDate(get(reconciliation, 'windowEnd', '')) },
          ]}
        />
      </DrawerSection>

      <DataTable
        toolbar={
          <div className="flex items-center gap-3 px-3 py-3">
            <span className="text-app-label text-[12px]">{size(exceptions)} mục lệch</span>
          </div>
        }
        label="Các trường hợp lệch"
        rows={exceptions}
        isLoading={isPending}
        emptyMessage="Không có trường hợp lệch nào trong kỳ."
        columns={[
          {
            key: 'outcome',
            label: 'Loại lệch',
            isRowHeader: true,
            renderCell: (exception) => {
              return <StatusChip status={exception.outcome} />;
            },
          },
          {
            key: 'reference',
            label: 'Tham chiếu',
            renderCell: (exception) => {
              return <span className="font-mono text-[11px]">{exception.reference}</span>;
            },
          },
          {
            key: 'source',
            label: 'Nguồn',
            renderCell: (exception) => {
              return exception.source;
            },
          },
          {
            key: 'processorAmount',
            label: 'Cổng',
            renderCell: (exception) => {
              return formatExceptionAmount(exception.processorAmount, currency);
            },
          },
          {
            key: 'ledgerAmount',
            label: 'Sổ',
            renderCell: (exception) => {
              return formatExceptionAmount(exception.ledgerAmount, currency);
            },
          },
          {
            key: 'invoiceAmount',
            label: 'Hoá đơn',
            renderCell: (exception) => {
              return formatExceptionAmount(exception.invoiceAmount, currency);
            },
          },
        ]}
      />
    </PageCard>
  );
}
