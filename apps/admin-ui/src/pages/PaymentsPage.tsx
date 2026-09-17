import PaymentIntentItem from '@components/PaymentIntentItem';
import TextField from '@components/ui/TextField';
import {
  useCreateRefundMutation,
  usePaymentIntentsQuery,
  useRefundsQuery,
} from '@pinstripe/sdk/react';
import { map, toUpper } from 'lodash-es';
import { useCallback, useState } from 'react';

const PAGE_LIMIT = 20;
const DEFAULT_REFUND_AMOUNT = '100000';

export default function PaymentsPage() {
  const [refundAmount, setRefundAmount] = useState(DEFAULT_REFUND_AMOUNT);

  const { data: paymentIntents, error } = usePaymentIntentsQuery(
    { limit: PAGE_LIMIT },
    { hasPlaceholder: true },
  );
  const { data: refunds } = useRefundsQuery({ limit: PAGE_LIMIT }, { hasPlaceholder: true });
  const { mutate: createRefund, isPending: isRefunding } = useCreateRefundMutation({
    successMessage: 'Đã hoàn tiền.',
  });

  const handleOnRefundAmountChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setRefundAmount(event.target.value);
  }, []);

  const handleOnRefund = useCallback(
    (paymentIntentId: string) => {
      createRefund({
        paymentIntentId,
        amount: Number(refundAmount),
        reason: 'Hoàn tiền từ admin',
      });
    },
    [createRefund, refundAmount],
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
        <p className="text-sm text-slate-500">
          PSP giả lập, chạy trong tiến trình. Thẻ quyết định kết quả: `pm_card_ok` thì duyệt,
          `pm_card_declined` thì từ chối. Mọi lần thử đều được giữ lại.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-4">
        <TextField
          label="Số tiền hoàn"
          type="number"
          className="w-40"
          value={refundAmount}
          onChange={handleOnRefundAmountChange}
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3">Hóa đơn</th>
              <th className="px-4 py-3 text-right">Số tiền</th>
              <th className="px-4 py-3">Các lần thử</th>
              <th className="px-4 py-3">Mã PSP</th>
              <th className="px-4 py-3">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {map(paymentIntents?.data, (paymentIntent) => {
              return (
                <PaymentIntentItem
                  key={paymentIntent.id}
                  paymentIntent={paymentIntent}
                  isBusy={isRefunding}
                  onRefund={handleOnRefund}
                />
              );
            })}
          </tbody>
        </table>
        {error ? <p className="px-4 py-3 text-red-600">{error.message}</p> : null}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Refunds</h2>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Hóa đơn</th>
                <th className="px-4 py-3">Lý do</th>
                <th className="px-4 py-3 text-right">Số tiền</th>
              </tr>
            </thead>
            <tbody>
              {map(refunds?.data, (refund) => {
                return (
                  <tr key={refund.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-mono text-xs">{refund.id}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      {refund.invoiceId}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{refund.reason}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {refund.amount.toLocaleString('vi-VN')} {toUpper(refund.currency)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
