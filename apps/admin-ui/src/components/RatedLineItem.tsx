import type { RatedInvoiceResponse } from '@pinstripe/core/contracts';
import { toUpper } from 'lodash-es';

interface RatedLineItemProps {
  lineItem: RatedInvoiceResponse['lineItems'][number];
  currency: string;
}

const PERCENT_DIGITS = 1;

export default function RatedLineItem({ lineItem, currency }: RatedLineItemProps) {
  return (
    <tr className="border-t border-slate-100">
      <td className="px-4 py-3">
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
          {lineItem.type}
        </span>
      </td>
      <td className="px-4 py-3 font-mono text-xs text-slate-500">{lineItem.priceId}</td>
      <td className="px-4 py-3 text-right tabular-nums">
        {lineItem.quantity.toLocaleString('vi-VN')}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-slate-500">
        {lineItem.ratedQuantity.toLocaleString('vi-VN')}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-slate-500">
        {(lineItem.prorationFactor * 100).toFixed(PERCENT_DIGITS)}%
      </td>
      <td className="px-4 py-3 text-right font-medium tabular-nums">
        {lineItem.amount.toLocaleString('vi-VN')} {toUpper(currency)}
      </td>
    </tr>
  );
}
