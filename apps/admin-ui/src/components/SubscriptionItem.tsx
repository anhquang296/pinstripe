import Button from '@components/ui/Button';
import type { SubscriptionResponse } from '@pinstripe/core/contracts';
import { useCallback } from 'react';

const STATUS_STYLES: Record<string, string> = {
  trialing: 'bg-sky-50 text-sky-700',
  active: 'bg-emerald-50 text-emerald-700',
  past_due: 'bg-amber-50 text-amber-700',
  unpaid: 'bg-orange-50 text-orange-700',
  canceled: 'bg-slate-100 text-slate-600',
  incomplete: 'bg-slate-100 text-slate-600',
};

interface SubscriptionItemProps {
  subscription: SubscriptionResponse;
  onCancel: (subscriptionId: string, cancelAtPeriodEnd: boolean) => void;
}

export default function SubscriptionItem({ subscription, onCancel }: SubscriptionItemProps) {
  const handleOnCancelAtPeriodEndClick = useCallback(() => {
    onCancel(subscription.id, true);
  }, [onCancel, subscription.id]);

  const handleOnCancelNowClick = useCallback(() => {
    onCancel(subscription.id, false);
  }, [onCancel, subscription.id]);

  return (
    <tr className="border-t border-slate-100 align-top">
      <td className="px-4 py-3 font-mono text-xs text-slate-500">{subscription.id}</td>
      <td className="px-4 py-3">
        <span
          className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[subscription.status] ?? ''}`}
        >
          {subscription.status}
        </span>
        {subscription.cancelAtPeriodEnd ? (
          <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
            hủy cuối kỳ
          </span>
        ) : null}
      </td>
      <td className="px-4 py-3 font-mono text-xs text-slate-500">{subscription.customerId}</td>
      <td className="px-4 py-3 text-slate-600">
        {new Date(subscription.currentPeriodStart).toLocaleDateString('vi-VN')} →{' '}
        {new Date(subscription.currentPeriodEnd).toLocaleDateString('vi-VN')}
      </td>
      <td className="px-4 py-3 text-slate-600">
        {subscription.trialEnd ? new Date(subscription.trialEnd).toLocaleDateString('vi-VN') : '—'}
      </td>
      <td className="px-4 py-3">
        {subscription.status === 'canceled' ? (
          <span className="text-xs text-slate-400">đã kết thúc</span>
        ) : (
          <div className="flex gap-2">
            <Button variant="ghost" onClick={handleOnCancelAtPeriodEndClick}>
              Hủy cuối kỳ
            </Button>
            <Button variant="ghost" onClick={handleOnCancelNowClick}>
              Hủy ngay
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}
