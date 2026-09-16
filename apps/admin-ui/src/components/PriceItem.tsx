import type { PriceResponse } from '@pinstripe/core/contracts';
import { size, toUpper } from 'lodash-es';

interface PriceItemProps {
  price: PriceResponse;
}

function formatAmount(price: PriceResponse): string {
  if (price.billingScheme === 'tiered') {
    return `${size(price.tiers)} tier (${price.tiersMode})`;
  }

  return `${(price.unitAmount ?? 0).toLocaleString('vi-VN')} ${toUpper(price.currency)}`;
}

export default function PriceItem({ price }: PriceItemProps) {
  return (
    <tr className="border-t border-slate-100">
      <td className="px-4 py-3 font-mono text-xs text-slate-500">{price.id}</td>
      <td className="px-4 py-3">{price.lookupKey ?? '—'}</td>
      <td className="px-4 py-3">v{price.version}</td>
      <td className="px-4 py-3">{formatAmount(price)}</td>
      <td className="px-4 py-3 text-slate-600">
        {price.recurring
          ? `mỗi ${price.recurring.intervalCount} ${price.recurring.interval}`
          : 'một lần'}
      </td>
      <td className="px-4 py-3 text-slate-500">
        {new Date(price.effectiveAt).toLocaleDateString('vi-VN')}
      </td>
    </tr>
  );
}
