import type { Price } from '@pinstripe/core/contracts';

export interface PriceItemProps {
  price: Price;
}

function formatAmount(price: Price): string {
  if (price.billingScheme === 'tiered') {
    return `${price.tiers?.length ?? 0} tier (${price.tiersMode})`;
  }

  return `${(price.unitAmount ?? 0).toLocaleString('vi-VN')} ${price.currency.toUpperCase()}`;
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
