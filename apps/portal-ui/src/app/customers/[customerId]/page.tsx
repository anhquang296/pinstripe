import { getInvoices, getSubscriptions } from '@lib/billing-api';
import { pinstripe } from '@lib/pinstripe';
import { map, toUpper } from 'lodash-es';

const STATUS_CLASSES: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  open: 'bg-amber-100 text-amber-700',
  paid: 'bg-emerald-100 text-emerald-700',
  void: 'bg-slate-200 text-slate-500 line-through',
  uncollectible: 'bg-red-100 text-red-700',
  active: 'bg-emerald-100 text-emerald-700',
  trialing: 'bg-sky-100 text-sky-700',
  canceled: 'bg-slate-200 text-slate-500',
  past_due: 'bg-amber-100 text-amber-700',
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('vi-VN');
}

export default async function CustomerPortalPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;

  const [customer, subscriptions, invoices] = await Promise.all([
    pinstripe.customers.retrieve(customerId),
    getSubscriptions(customerId),
    getInvoices(customerId),
  ]);

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-10 px-6 py-12">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">
          {customer.name || customer.email || customer.id}
        </h1>
        <p className="font-mono text-xs text-slate-500">{customer.id}</p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Gói đang dùng
        </h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-160 text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Mã</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3">Kỳ hiện tại</th>
                <th className="px-4 py-3">Hết trial</th>
              </tr>
            </thead>
            <tbody>
              {map(subscriptions.data, (subscription) => {
                return (
                  <tr key={subscription.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      {subscription.id}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_CLASSES[subscription.status] ?? ''}`}
                      >
                        {subscription.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatDate(subscription.currentPeriodStart)} →{' '}
                      {formatDate(subscription.currentPeriodEnd)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {subscription.trialEnd ? formatDate(subscription.trialEnd) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Hóa đơn</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-176 text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Số</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3">Kỳ</th>
                <th className="px-4 py-3 text-right">Tổng</th>
                <th className="px-4 py-3 text-right">Còn lại</th>
              </tr>
            </thead>
            <tbody>
              {map(invoices.data, (invoice) => {
                return (
                  <tr key={invoice.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-mono text-xs">{invoice.number ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_CLASSES[invoice.status] ?? ''}`}
                      >
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatDate(invoice.periodStart)} → {formatDate(invoice.periodEnd)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {invoice.total.toLocaleString('vi-VN')} {toUpper(invoice.currency)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      {invoice.amountRemaining.toLocaleString('vi-VN')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-xs text-slate-400">
        Trang này chưa có đăng nhập khách hàng — ai có link là xem được. Xem
        docs/adr/0012-phase-9-portal-reporting.md trước khi mở ra ngoài.
      </p>
    </main>
  );
}
