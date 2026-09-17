import InvoiceItem from '@components/InvoiceItem';
import Button from '@components/ui/Button';
import SelectField from '@components/ui/SelectField';
import TextField from '@components/ui/TextField';
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
import { map, toUpper } from 'lodash-es';
import { useCallback, useMemo, useState } from 'react';

const PAGE_LIMIT = 20;
const OPTION_LIMIT = 100;
const DEFAULT_CREDIT_AMOUNT = '100000';
const APPROVED_PAYMENT_METHOD = 'pm_card_ok';
const DECLINED_PAYMENT_METHOD = 'pm_card_declined';

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
        if (paymentIntent.failureMessage) {
          toast.show(paymentIntent.failureMessage, { isError: true });

          return;
        }

        toast.show('Đã thu tiền qua PSP.');
      },
    };
  }, []);

  const handleOnCharge = useCallback(
    (invoiceId: string) => {
      chargeInvoice({ invoiceId, paymentMethod: APPROVED_PAYMENT_METHOD }, chargeOptions);
    },
    [chargeInvoice, chargeOptions],
  );

  const handleOnDecline = useCallback(
    (invoiceId: string) => {
      chargeInvoice({ invoiceId, paymentMethod: DECLINED_PAYMENT_METHOD }, chargeOptions);
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

      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-4">
        <SelectField
          label="Subscription"
          options={subscriptionOptions}
          value={selectedSubscriptionId}
          onChange={handleOnSubscriptionChange}
        />
        <Button onClick={handleOnDraft} disabled={isCreating || !selectedSubscriptionId}>
          Tạo hóa đơn nháp
        </Button>
        <TextField
          label="Số tiền credit note"
          type="number"
          className="w-40"
          value={creditAmount}
          onChange={handleOnCreditAmountChange}
        />
      </div>

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
                  onDecline={handleOnDecline}
                  onVoid={handleOnVoid}
                  onCredit={handleOnCredit}
                />
              );
            })}
          </tbody>
        </table>
        {error ? <p className="px-4 py-3 text-red-600">{error.message}</p> : null}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Credit notes</h2>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Số</th>
                <th className="px-4 py-3">Hóa đơn</th>
                <th className="px-4 py-3">Lý do</th>
                <th className="px-4 py-3 text-right">Số tiền</th>
              </tr>
            </thead>
            <tbody>
              {map(creditNotes?.data, (creditNote) => {
                return (
                  <tr key={creditNote.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-mono text-xs">{creditNote.number}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      {creditNote.invoiceId}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{creditNote.reason}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {creditNote.amount.toLocaleString('vi-VN')} {toUpper(creditNote.currency)}
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
