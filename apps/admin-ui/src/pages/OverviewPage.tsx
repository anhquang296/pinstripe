import DetailList from '@components/DetailList';
import DrawerSection from '@components/DrawerSection';
import PageCard from '@components/PageCard';
import StatGrid from '@components/StatGrid';
import StatItem from '@components/StatItem';
import StatusChip from '@components/StatusChip';
import { Button } from '@heroui/react';
import { useReportWindow } from '@hooks/useReportWindow';
import { formatCurrency } from '@lib/format';
import { CurrencyEnum } from '@pinstripe/core/contracts';
import { useReconciliationReportQuery, useRevenueSummaryQuery } from '@pinstripe/sdk/react';
import { get, size } from 'lodash-es';
import { useNavigate } from 'react-router-dom';

const WINDOW_DAYS = 30;

export default function OverviewPage() {
  const navigate = useNavigate();
  const reportWindow = useReportWindow(WINDOW_DAYS);

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
      description={`Doanh thu và đối soát ${WINDOW_DAYS} ngày gần nhất.`}
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
          label="Đã hoàn"
          value={formatCurrency(get(revenue, 'refundedInWindow', 0), currency)}
          meta={`Còn phải thu ${formatCurrency(get(revenue, 'outstanding', 0), currency)}`}
        />
        <StatItem
          label="Thuê bao đang chạy"
          value={get(revenue, 'activeSubscriptions', 0)}
          meta={`Dùng thử ${get(revenue, 'trialingSubscriptions', 0)}`}
        />
      </StatGrid>

      <DrawerSection
        title="Đối soát nhanh"
        actions={<StatusChip status={difference === 0 ? 'matched' : 'amount_mismatch'} />}
      >
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
