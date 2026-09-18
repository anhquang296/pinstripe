import InvoiceItem from '@components/InvoiceItem';
import { OPTION_LIMIT, PAGE_LIMIT } from '@constants/pagination';
import { toast } from '@lib/toast';
import type { PaymentIntentResponse } from '@pinstripe/sdk';
import {
  useChargeInvoiceMutation,
  useCreateCreditNoteMutation,
  useCreateInvoiceMutation,
  useCreditNotesQuery,
  useFinalizeInvoiceMutation,
  useInvoicesQuery,
  useSubscriptionsQuery,
  useVoidInvoiceMutation,
} from '@pinstripe/sdk/react';
import { get, map } from 'lodash-es';
import { useCallback, useMemo, useState } from 'react';

import CreditNoteCard from './CreditNoteCard';
import InvoiceDraftPanel from './InvoiceDraftPanel';

const DEFAULT_CREDIT_AMOUNT = '100000';

export default function InvoicesPage() {
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState('');
  const [creditAmount, setCreditAmount] = useState(DEFAULT_CREDIT_AMOUNT);

  const { data: invoices, error } = useInvoicesQuery(
    { limit: PAGE_LIMIT },
    { hasPlaceholder: true },
  );
  const { data: creditNotes } = useCreditNotesQuery(
    { limit: PAGE_LIMIT },
    { hasPlaceholder: true },
  );
  const { data: subscriptions } = useSubscriptionsQuery({ limit: OPTION_LIMIT });
  const { mutate: createInvoice, isPending: isCreating } = useCreateInvoiceMutation({
    successMessage: 'Đã tạo hóa đơn nháp.',
  });
  const { mutate: finalizeInvoice, isPending: isFinalizing } = useFinalizeInvoiceMutation({
    successMessage: (invoice) => {
      if (invoice.number) {
        return `Đã phát hành ${invoice.number}.`;
      }

      return 'Đã phát hành hóa đơn.';
    },
  });
  const { mutate: chargeInvoice, isPending: isCharging } = useChargeInvoiceMutation();
  const { mutate: voidInvoice, isPending: isVoiding } = useVoidInvoiceMutation({
    successMessage: 'Đã hủy hóa đơn.',
  });
  const { mutate: createCreditNote, isPending: isCrediting } = useCreateCreditNoteMutation({
    successMessage: (creditNote) => {
      return `Đã tạo ${creditNote.number}.`;
    },
  });

  const subscriptionOptions = useMemo(() => {
    return [
      { value: '', label: '— chọn subscription —' },
      ...map(subscriptions?.data, (subscription) => {
        return { value: subscription.id, label: `${subscription.id} · ${subscription.status}` };
      }),
    ];
  }, [subscriptions]);

  const handleOnSubscriptionChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSubscriptionId(event.target.value);
  }, []);

  const handleOnCreditAmountChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setCreditAmount(event.target.value);
  }, []);

  const handleOnDraft = useCallback(() => {
    if (selectedSubscriptionId) {
      createInvoice({ subscriptionId: selectedSubscriptionId });
    }
  }, [createInvoice, selectedSubscriptionId]);

  const handleOnFinalize = useCallback(
    (invoiceId: string) => {
      finalizeInvoice(invoiceId);
    },
    [finalizeInvoice],
  );

  const chargeOptions = useMemo(() => {
    return {
      onSuccess: (paymentIntent: PaymentIntentResponse) => {
        const { failureMessage } = paymentIntent;

        if (failureMessage) {
          toast.show(failureMessage, { isError: true });

          return;
        }

        toast.show(`Đã gửi yêu cầu thu tiền, intent đang ${paymentIntent.status}.`);
      },
    };
  }, []);

  const handleOnCharge = useCallback(
    (invoiceId: string) => {
      chargeInvoice({ invoiceId }, chargeOptions);
    },
    [chargeInvoice, chargeOptions],
  );

  const handleOnVoid = useCallback(
    (invoiceId: string) => {
      voidInvoice({ id: invoiceId, payload: {} });
    },
    [voidInvoice],
  );

  const handleOnCredit = useCallback(
    (invoiceId: string) => {
      createCreditNote({
        invoiceId,
        amount: Number(creditAmount),
        reason: 'Điều chỉnh từ admin',
      });
    },
    [createCreditNote, creditAmount],
  );

  const creditNoteRows = get(creditNotes, 'data', []);
  const isBusy = isFinalizing || isCharging || isVoiding || isCrediting;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
        <p className="text-sm text-slate-500">
          Nháp còn sửa được. Phát hành rồi thì số và số tiền đóng băng — sai thì ra credit note,
          không sửa ngược.
        </p>
      </div>

      <InvoiceDraftPanel
        subscriptionOptions={subscriptionOptions}
        selectedSubscriptionId={selectedSubscriptionId}
        creditAmount={creditAmount}
        isCreating={isCreating}
        onSubscriptionChange={handleOnSubscriptionChange}
        onCreditAmountChange={handleOnCreditAmountChange}
        onDraft={handleOnDraft}
      />

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[64rem] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Số</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3">Khách hàng</th>
              <th className="px-4 py-3 text-right">Tổng</th>
              <th className="px-4 py-3 text-right">Đã trả</th>
              <th className="px-4 py-3 text-right">Đã credit</th>
              <th className="px-4 py-3 text-right">Đã hoàn</th>
              <th className="px-4 py-3 text-right">Còn lại</th>
              <th className="px-4 py-3">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {map(invoices?.data, (invoice) => {
              return (
                <InvoiceItem
                  key={invoice.id}
                  invoice={invoice}
                  isBusy={isBusy}
                  onFinalize={handleOnFinalize}
                  onCharge={handleOnCharge}
                  onVoid={handleOnVoid}
                  onCredit={handleOnCredit}
                />
              );
            })}
          </tbody>
        </table>
        {error ? <p className="px-4 py-3 text-red-600">{error.message}</p> : null}
      </div>

      <CreditNoteCard creditNotes={creditNoteRows} />
    </div>
  );
}
