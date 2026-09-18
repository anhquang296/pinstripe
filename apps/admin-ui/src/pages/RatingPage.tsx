import PageCard from '@components/PageCard';
import RatedLineItem from '@components/RatedLineItem';
import { OPTION_LIMIT } from '@constants/pagination';
import { Label, ListBox, Select } from '@heroui/react';
import { useSubscriptionsQuery, useUpcomingInvoiceQuery } from '@pinstripe/sdk/react';
import { map, toString, toUpper } from 'lodash-es';
import { useCallback, useMemo, useState } from 'react';

export default function RatingPage() {
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState('');

  const { data: subscriptions } = useSubscriptionsQuery({ limit: OPTION_LIMIT });
  const { data: ratedInvoice, error } = useUpcomingInvoiceQuery(selectedSubscriptionId);

  const subscriptionOptions = useMemo(() => {
    return map(subscriptions?.data, (subscription) => {
      return {
        value: subscription.id,
        label: `${subscription.id} · ${subscription.status}`,
      };
    });
  }, [subscriptions]);

  const handleOnSubscriptionChange = useCallback((key: unknown) => {
    setSelectedSubscriptionId(toString(key));
  }, []);

  return (
    <PageCard
      title="Rating"
      description="Áp giá lên kỳ hiện tại. Đây là kết quả tính, chưa phải hóa đơn — chưa có số, chưa chốt, hỏi lại lúc nào cũng tính lại từ đầu."
    >
      <div className="border-app-border-soft flex flex-wrap items-end gap-4 rounded-md border bg-surface p-4">
        <Select
          className="flex flex-col gap-1"
          placeholder="— chọn subscription —"
          selectedKey={selectedSubscriptionId === '' ? null : selectedSubscriptionId}
          onSelectionChange={handleOnSubscriptionChange}
        >
          <Label>Subscription</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {map(subscriptionOptions, (subscriptionOption) => {
                return (
                  <ListBox.Item key={subscriptionOption.value} id={subscriptionOption.value}>
                    {subscriptionOption.label}
                  </ListBox.Item>
                );
              })}
            </ListBox>
          </Select.Popover>
        </Select>
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
    </PageCard>
  );
}
