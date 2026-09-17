import RatedLineItem from '@components/RatedLineItem';
import SelectField from '@components/ui/SelectField';
import { useSubscriptionsQuery, useUpcomingInvoiceQuery } from '@pinstripe/sdk/react';
import { map, toUpper } from 'lodash-es';
import { useCallback, useMemo, useState } from 'react';

const OPTION_LIMIT = 100;

export default function RatingPage() {
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState('');

  const { data: subscriptions } = useSubscriptionsQuery({ limit: OPTION_LIMIT });
  const { data: ratedInvoice, error } = useUpcomingInvoiceQuery(selectedSubscriptionId);

  const subscriptionOptions = useMemo(() => {
    return [
      { value: '', label: '— chọn subscription —' },
      ...map(subscriptions?.data, (subscription) => {
        return {
          value: subscription.id,
          label: `${subscription.id} · ${subscription.status}`,
        };
      }),
    ];
  }, [subscriptions]);

  const handleOnSubscriptionChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSubscriptionId(event.target.value);
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Rating</h1>
        <p className="text-sm text-slate-500">
          Áp giá lên kỳ hiện tại. Đây là kết quả tính, chưa phải hóa đơn — chưa có số, chưa chốt,
          hỏi lại lúc nào cũng tính lại từ đầu.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-4">
        <SelectField
          label="Subscription"
          options={subscriptionOptions}
          value={selectedSubscriptionId}
          onChange={handleOnSubscriptionChange}
        />
        {ratedInvoice ? (
          <div className="ml-auto flex flex-col text-right">
            <span className="text-2xl font-semibold tabular-nums">
              {ratedInvoice.total.toLocaleString('vi-VN')} {toUpper(ratedInvoice.currency)}
            </span>
            <span className="text-xs text-slate-500">
              {new Date(ratedInvoice.periodStart).toLocaleDateString('vi-VN')} →{' '}
              {new Date(ratedInvoice.periodEnd).toLocaleDateString('vi-VN')}
            </span>
          </div>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-600">{error.message}</p> : null}

      {ratedInvoice ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Loại</th>
                <th className="px-4 py-3">Bảng giá</th>
                <th className="px-4 py-3 text-right">Số lượng</th>
                <th className="px-4 py-3 text-right">Sau quy đổi</th>
                <th className="px-4 py-3 text-right">Tỷ lệ kỳ</th>
                <th className="px-4 py-3 text-right">Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {map(ratedInvoice.lineItems, (lineItem) => {
                return (
                  <RatedLineItem
                    key={lineItem.subscriptionItemId}
                    lineItem={lineItem}
                    currency={ratedInvoice.currency}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
