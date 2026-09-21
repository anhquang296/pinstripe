import DetailList from '@common/components/DetailList';
import DrawerSection from '@common/components/DrawerSection';
import PageCard from '@common/components/PageCard';
import StatGrid from '@common/components/StatGrid';
import StatItem from '@common/components/StatItem';
import { useReportRangeLabel, useReportWindow } from '@common/hooks/useReportWindow';
import { formatCurrency } from '@common/utils/format';
import { Button } from '@heroui/react';
import { CurrencyEnum } from '@vxrerp/core/contracts';
import { useReconciliationReportQuery, useRevenueSummaryQuery } from '@vxrerp/sdk/react';
import { get, size } from 'lodash-es';
import { useNavigate } from 'react-router-dom';

export default function OverviewPage() {
  const navigate = useNavigate();
  const reportWindow = useReportWindow();
  const rangeLabel = useReportRangeLabel();

  const { data: revenue } = useRevenueSummaryQuery(reportWindow);

  const { data: reconciliation } = useReconciliationReportQuery(reportWindow);

  const currency = get(revenue, 'currency', CurrencyEnum.VND);
  const difference = get(reconciliation, 'difference', 0);
  const exceptionCount = size(get(reconciliation, 'exceptions', []));

  const handleOnOpenReports = () => {
    navigate('/reports');
  };

  return (
    <PageCard
      title="Tổng quan"
      description={`Doanh thu và đối soát — ${rangeLabel}.`}
      actions={
        <Button variant="ghost" onPress={handleOnOpenReports}>
          Xem báo cáo đầy đủ
        </Button>
      }
    >
      <StatGrid>
        <StatItem
          label="MRR"
          value={formatCurrency(get(revenue, 'mrr', 0), currency)}
          meta={`ARR ${formatCurrency(get(revenue, 'arr', 0), currency)}`}
        />
        <StatItem
          label="Đã xuất hoá đơn"
          value={formatCurrency(get(revenue, 'invoicedInWindow', 0), currency)}
          meta={`Đã thu ${formatCurrency(get(revenue, 'collectedInWindow', 0), currency)}`}
        />
        <StatItem
          label="Còn phải thu"
          value={formatCurrency(get(revenue, 'outstanding', 0), currency)}
          meta={`Đã hoàn ${formatCurrency(get(revenue, 'refundedInWindow', 0), currency)}`}
        />
        <StatItem
          label="Thuê bao đang chạy"
          value={get(revenue, 'activeSubscriptions', 0)}
          meta={`Dùng thử ${get(revenue, 'trialingSubscriptions', 0)}`}
        />
      </StatGrid>

      <DrawerSection title="Đối soát nhanh">
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
            { label: 'Chênh lệch', value: formatCurrency(difference, currency) },
            { label: 'Số mục lệch', value: exceptionCount },
          ]}
        />
      </DrawerSection>
    </PageCard>
  );
}
