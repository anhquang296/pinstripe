import Button from '@components/ui/Button';
import { COLLECTION_METHOD_LABELS } from '@constants/collection-method';
import type { InvoiceResponse } from '@pinstripe/core/contracts';
import { InvoiceStatusEnum } from '@pinstripe/core/contracts';
import { toUpper } from 'lodash-es';
import { useCallback } from 'react';

interface InvoiceItemProps {
  invoice: InvoiceResponse;
  isBusy: boolean;
  onFinalize: (invoiceId: string) => void;
  onCharge: (invoiceId: string) => void;
  onVoid: (invoiceId: string) => void;
  onCredit: (invoiceId: string) => void;
}

const STATUS_CLASSES: Record<string, string> = {
  [InvoiceStatusEnum.DRAFT]: 'bg-slate-100 text-slate-600',
  [InvoiceStatusEnum.OPEN]: 'bg-amber-100 text-amber-700',
  [InvoiceStatusEnum.PAID]: 'bg-emerald-100 text-emerald-700',
  [InvoiceStatusEnum.VOID]: 'bg-slate-200 text-slate-500 line-through',
  [InvoiceStatusEnum.UNCOLLECTIBLE]: 'bg-red-100 text-red-700',
};

export default function InvoiceItem({
  invoice,
  isBusy,
  onFinalize,
  onCharge,
  onVoid,
  onCredit,
}: InvoiceItemProps) {
  const handleOnFinalize = useCallback(() => {
    onFinalize(invoice.id);
  }, [invoice.id, onFinalize]);

  const handleOnCharge = useCallback(() => {
    onCharge(invoice.id);
  }, [invoice.id, onCharge]);

  const handleOnVoid = useCallback(() => {
    onVoid(invoice.id);
  }, [invoice.id, onVoid]);

  const handleOnCredit = useCallback(() => {
    onCredit(invoice.id);
  }, [invoice.id, onCredit]);

  const isDraft = invoice.status === InvoiceStatusEnum.DRAFT;
  const isOpen = invoice.status === InvoiceStatusEnum.OPEN;
  const { number, id } = invoice;
  const numberLabel = number === null ? id : number;

  return (
    <tr className="border-t border-slate-100 align-top">
      <td className="px-4 py-3 font-mono text-xs text-slate-500">{numberLabel}</td>
      <td className="px-4 py-3">
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_CLASSES[invoice.status] ?? ''}`}
        >
          {invoice.status}
        </span>
        <div className="mt-1 text-xs text-slate-500">
          {COLLECTION_METHOD_LABELS[invoice.collectionMethod]}
        </div>
      </td>
      <td className="px-4 py-3 font-mono text-xs text-slate-500">{invoice.customerId}</td>
      <td className="px-4 py-3 text-right tabular-nums">
        {invoice.total.toLocaleString('vi-VN')} {toUpper(invoice.currency)}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-slate-500">
        {invoice.amountPaid.toLocaleString('vi-VN')}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-slate-500">
        {invoice.amountCredited.toLocaleString('vi-VN')}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-slate-500">
        {invoice.amountRefunded.toLocaleString('vi-VN')}
      </td>
      <td className="px-4 py-3 text-right font-medium tabular-nums">
        {invoice.amountRemaining.toLocaleString('vi-VN')}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-2">
          {isDraft ? (
            <Button variant="ghost" onClick={handleOnFinalize} disabled={isBusy}>
              Phát hành
            </Button>
          ) : null}
          {isOpen ? (
            <Button variant="ghost" onClick={handleOnCharge} disabled={isBusy}>
              Thu tiền
            </Button>
          ) : null}
          {isOpen ? (
            <Button variant="ghost" onClick={handleOnCredit} disabled={isBusy}>
              Credit note
            </Button>
          ) : null}
          {isDraft || isOpen ? (
            <Button variant="ghost" onClick={handleOnVoid} disabled={isBusy}>
              Hủy
            </Button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
