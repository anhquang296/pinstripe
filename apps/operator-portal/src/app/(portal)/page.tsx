'use client';

import PageCard from '@common/components/PageCard';
import StatGrid from '@common/components/StatGrid';
import StatItem from '@common/components/StatItem';
import { formatCurrency, formatDate } from '@common/utils/format';
import InvoicesTable from '@features/portal/components/InvoicesTable';
import SubscriptionCard from '@features/portal/components/SubscriptionCard';
import { Card, Link } from '@heroui/react';
import { SubscriptionStatusEnum } from '@vxrerp/core/contracts';
import type { InvoiceResponse } from '@vxrerp/sdk';
import {
  usePortalAccountQuery,
  usePortalInvoicesQuery,
  usePortalInvoiceTotalsQuery,
  usePortalSubscriptionsQuery,
} from '@vxrerp/sdk/react/portal';
import { filter, find, get, includes, isEmpty, map } from 'lodash-es';
import { useRouter } from 'next/navigation';

const RECENT_INVOICE_LIMIT = 5;

const CURRENT_SUBSCRIPTION_STATUSES: string[] = [
  SubscriptionStatusEnum.ACTIVE,
  SubscriptionStatusEnum.TRIALING,
  SubscriptionStatusEnum.PAST_DUE,
  SubscriptionStatusEnum.UNPAID,
  SubscriptionStatusEnum.PAUSED,
];

export default function OverviewPage() {
  const router = useRouter();

  const { data: account } = usePortalAccountQuery();

  const { data: invoiceTotals } = usePortalInvoiceTotalsQuery();

  const { data: recentInvoices, isPending: isInvoicesPending } = usePortalInvoicesQuery({
    limit: RECENT_INVOICE_LIMIT,
  });

  const { data: subscriptions } = usePortalSubscriptionsQuery({ limit: 20 });

  const currency = get(account, 'currency', 'vnd');
  const currencyTotals = find(get(invoiceTotals, 'totals', []), { currency });
  const openAmount = get(currencyTotals, 'openAmount', 0);
  const openCount = get(currencyTotals, 'openCount', 0);
  const overdueAmount = get(currencyTotals, 'overdueAmount', 0);
  const overdueCount = get(currencyTotals, 'overdueCount', 0);
  const dueSoonAmount = get(currencyTotals, 'dueSoonAmount', 0);
  const dueSoonCount = get(currencyTotals, 'dueSoonCount', 0);
  const nextDueAt = get(currencyTotals, 'nextDueAt', null);
  const nextDueLabel = nextDueAt ? formatDate(nextDueAt) : '—';

  const nextDueMeta = nextDueAt
    ? 'Hóa đơn chưa thanh toán kế tiếp'
    : 'Không có hóa đơn sắp đến hạn';

  const currentSubscriptions = filter(get(subscriptions, 'data', []), (subscription) => {
    return includes(CURRENT_SUBSCRIPTION_STATUSES, subscription.status);
  });

  const handleOnInvoiceSelect = (invoice: InvoiceResponse) => {
    router.push(`/invoices/${invoice.id}`);
  };

  return (
    <PageCard
      title="Tổng quan"
      description="Công nợ, hóa đơn gần đây và các gói dịch vụ nhà xe đang dùng."
    >
      <StatGrid>
        <StatItem
          label="Tổng còn phải trả"
          value={formatCurrency(openAmount, currency)}
          meta={`${openCount} hóa đơn chưa thanh toán`}
        />
        <StatItem
          label="Quá hạn"
          value={formatCurrency(overdueAmount, currency)}
          meta={`${overdueCount} hóa đơn quá hạn`}
        />
        <StatItem
          label="Đến hạn trong 7 ngày"
          value={formatCurrency(dueSoonAmount, currency)}
          meta={`${dueSoonCount} hóa đơn sắp đến hạn`}
        />
        <StatItem label="Hạn thanh toán gần nhất" value={nextDueLabel} meta={nextDueMeta} />
      </StatGrid>

      <Card>
        <Card.Header className="flex-row items-center justify-between">
          <Card.Title>Hóa đơn gần đây</Card.Title>
          <Link href="/invoices">Xem tất cả</Link>
        </Card.Header>
      </Card>
      <InvoicesTable
        invoices={get(recentInvoices, 'data', [])}
        isLoading={isInvoicesPending}
        onInvoiceSelect={handleOnInvoiceSelect}
      />

      <Card>
        <Card.Header className="flex-row items-center justify-between">
          <Card.Title>Gói đang sử dụng</Card.Title>
          <Link href="/subscriptions">Xem tất cả</Link>
        </Card.Header>
        {isEmpty(currentSubscriptions) ? (
          <Card.Content>
            <span className="text-sm text-muted">Nhà xe chưa có gói dịch vụ đang hoạt động.</span>
          </Card.Content>
        ) : null}
      </Card>
      {map(currentSubscriptions, (subscription) => {
        return <SubscriptionCard key={subscription.id} subscription={subscription} />;
      })}
    </PageCard>
  );
}
