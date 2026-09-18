import { Button } from '@heroui/react';
import type { PaymentIntentResponse } from '@pinstripe/core/contracts';
import { PaymentIntentStatusEnum } from '@pinstripe/core/contracts';
import { map, toUpper } from 'lodash-es';
import { useCallback } from 'react';

interface PaymentIntentItemProps {
  paymentIntent: PaymentIntentResponse;
  isBusy: boolean;
  onRefund: (chargeId: string) => void;
}

const STATUS_CLASSES: Record<string, string> = {
  [PaymentIntentStatusEnum.REQUIRES_PAYMENT_METHOD]: 'bg-amber-100 text-amber-700',
  [PaymentIntentStatusEnum.REQUIRES_CONFIRMATION]: 'bg-sky-100 text-sky-700',
  [PaymentIntentStatusEnum.REQUIRES_ACTION]: 'bg-violet-100 text-violet-700',
  [PaymentIntentStatusEnum.PROCESSING]: 'bg-sky-100 text-sky-700',
  [PaymentIntentStatusEnum.REQUIRES_CAPTURE]: 'bg-indigo-100 text-indigo-700',
  [PaymentIntentStatusEnum.SUCCEEDED]: 'bg-emerald-100 text-emerald-700',
  [PaymentIntentStatusEnum.CANCELED]: 'bg-slate-200 text-slate-500',
};

export default function PaymentIntentItem({
  paymentIntent,
  isBusy,
  onRefund,
}: PaymentIntentItemProps) {
  const { latestChargeId, pspReference } = paymentIntent;

  const handleOnRefund = useCallback(() => {
    if (latestChargeId) {
      onRefund(latestChargeId);
    }
  }, [onRefund, latestChargeId]);

  const isSucceeded =
    paymentIntent.status === PaymentIntentStatusEnum.SUCCEEDED && Boolean(latestChargeId);

  return (
    <tr className="border-t border-slate-100 align-top">
      <td className="px-4 py-3 font-mono text-xs text-slate-500">{paymentIntent.id}</td>
      <td className="px-4 py-3">
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_CLASSES[paymentIntent.status] ?? ''}`}
        >
          {paymentIntent.status}
        </span>
        {paymentIntent.failureCode ? (
          <p className="mt-1 text-xs text-red-600">{paymentIntent.failureCode}</p>
        ) : null}
      </td>
      <td className="px-4 py-3 font-mono text-xs text-slate-500">{paymentIntent.invoiceId}</td>
      <td className="px-4 py-3 text-right tabular-nums">
        {paymentIntent.amount.toLocaleString('vi-VN')} {toUpper(paymentIntent.currency)}
      </td>
      <td className="px-4 py-3 text-xs text-slate-500">
        {map(paymentIntent.charges, (charge) => {
          return (
            <span key={charge.id} className="mr-1 rounded bg-slate-100 px-1.5 py-0.5">
              {charge.outcome}
            </span>
          );
        })}
      </td>
      <td className="px-4 py-3 font-mono text-xs text-slate-500">
        {pspReference === null ? '—' : pspReference}
      </td>
      <td className="px-4 py-3">
        {isSucceeded ? (
          <Button variant="ghost" onPress={handleOnRefund} isDisabled={isBusy}>
            Hoàn tiền
          </Button>
        ) : null}
      </td>
    </tr>
  );
}
