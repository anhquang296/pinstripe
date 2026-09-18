import PageCard from '@components/PageCard';
import StatGrid from '@components/StatGrid';
import StatItem from '@components/StatItem';
import { MILLISECONDS_PER_DAY } from '@constants/time';
import { useReconciliationReportQuery, useRevenueSummaryQuery } from '@pinstripe/sdk/react';
import { isNil, map, toUpper } from 'lodash-es';
import { useMemo } from 'react';

const WINDOW_DAYS = 30;
const EXCEPTION_LIMIT = 20;

const OUTCOME_CLASSES: Record<string, string> = {
  missing_in_ledger: 'bg-red-100 text-red-700',
  missing_in_processor: 'bg-amber-100 text-amber-700',
  amount_mismatch: 'bg-red-100 text-red-700',
};

const MISSING_AMOUNT = '—';

function formatAmount(amount: number | null): string {
  if (isNil(amount)) {
    return MISSING_AMOUNT;
  }

  return amount.toLocaleString('vi-VN');
}

function buildWindow() {
  const now = Date.now();

  return {
    windowStart: new Date(now - WINDOW_DAYS * MILLISECONDS_PER_DAY).toISOString(),
    windowEnd: new Date(now + MILLISECONDS_PER_DAY).toISOString(),
  };
}

export default function ReportsPage() {
  const window = useMemo(() => {
    return buildWindow();
  }, []);

  const { data: revenue, error } = useRevenueSummaryQuery(window, { hasPlaceholder: true });
  const { data: reconciliation } = useReconciliationReportQuery(window, { hasPlaceholder: true });

  const metrics = useMemo(() => {
    if (!revenue) {
      return [];
    }

    const currency = toUpper(revenue.currency);

    return [
      { label: 'MRR', value: `${revenue.mrr.toLocaleString('vi-VN')} ${currency}` },
      { label: 'ARR', value: `${revenue.arr.toLocaleString('vi-VN')} ${currency}` },
      { label: 'Đang hoạt động', value: revenue.activeSubscriptions.toLocaleString('vi-VN') },
      { label: 'Đang dùng thử', value: revenue.trialingSubscriptions.toLocaleString('vi-VN') },
      { label: 'Churn trong kỳ', value: `${(revenue.churnRate * 100).toFixed(2)}%` },
      {
        label: 'Còn phải thu',
        value: `${revenue.outstanding.toLocaleString('vi-VN')} ${currency}`,
      },
    ];
  }, [revenue]);

  return (
    <PageCard
      title="Reports"
      description="MRR quy về tháng từ gói đang chạy. Đối soát so tiền cổng thanh toán với tiền mặt trên sổ — lệch thì hiện ở đây, không im lặng."
    >
      <StatGrid>
        {map(metrics, (metric) => {
          return <StatItem key={metric.label} label={metric.label} value={metric.value} />;
        })}
      </StatGrid>

      {error ? <p className="text-[13px] text-danger">{error.message}</p> : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Đối soát {WINDOW_DAYS} ngày
        </h2>
        {reconciliation ? (
          <div className="flex flex-wrap gap-4 rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-col">
              <span className="text-xs text-slate-500">Cổng thanh toán</span>
              <span className="text-lg font-semibold tabular-nums">
                {reconciliation.processorTotal.toLocaleString('vi-VN')}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-slate-500">Sổ cái</span>
              <span className="text-lg font-semibold tabular-nums">
                {reconciliation.ledgerTotal.toLocaleString('vi-VN')}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-slate-500">Chênh lệch</span>
              <span
                className={`text-lg font-semibold tabular-nums ${
                  reconciliation.difference === 0 ? 'text-emerald-600' : 'text-red-600'
                }`}
              >
                {reconciliation.difference.toLocaleString('vi-VN')}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-slate-500">Khớp</span>
              <span className="text-lg font-semibold tabular-nums">{reconciliation.matched}</span>
            </div>
          </div>
        ) : null}

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Loại lệch</th>
                <th className="px-4 py-3">Tham chiếu</th>
                <th className="px-4 py-3 text-right">Cổng</th>
                <th className="px-4 py-3 text-right">Sổ</th>
              </tr>
            </thead>
            <tbody>
              {map(reconciliation?.exceptions.slice(0, EXCEPTION_LIMIT), (exception) => {
                return (
                  <tr key={exception.reference} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${OUTCOME_CLASSES[exception.outcome] ?? ''}`}
                      >
                        {exception.outcome}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      {exception.reference}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatAmount(exception.processorAmount)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatAmount(exception.ledgerAmount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </PageCard>
  );
}
