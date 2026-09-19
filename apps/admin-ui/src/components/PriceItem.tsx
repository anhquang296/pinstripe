import { Button } from '@heroui/react';
import { formatPriceAmount } from '@lib/price';
import type { PriceResponse } from '@pinstripe/core/contracts';

interface PriceItemProps {
  price: PriceResponse;
  onToggleActive: (priceId: string, active: boolean) => void;
}

export default function PriceItem({ price, onToggleActive }: PriceItemProps) {
  const { lookupKey } = price;

  const handleOnToggleActive = () => {
    onToggleActive(price.id, !price.active);
  };

  return (
    <tr className="border-t border-slate-100">
      <td className="px-4 py-3 font-mono text-xs text-slate-500">{price.id}</td>
      <td className="px-4 py-3">{lookupKey === null ? '—' : lookupKey}</td>
      <td className="px-4 py-3">v{price.version}</td>
      <td className="px-4 py-3">{formatPriceAmount(price)}</td>
      <td className="px-4 py-3 text-slate-600">
        {price.recurring
          ? `mỗi ${price.recurring.intervalCount} ${price.recurring.interval}`
          : 'một lần'}
      </td>
      <td className="px-4 py-3 text-slate-500">
        {new Date(price.effectiveAt).toLocaleDateString('vi-VN')}
      </td>
      <td className="px-4 py-3">
        <span
          className={
            price.active
              ? 'rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700'
              : 'rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600'
          }
        >
          {price.active ? 'active' : 'archived'}
        </span>
      </td>
      <td className="px-4 py-3">
        <Button variant="ghost" onPress={handleOnToggleActive}>
          {price.active ? 'Ngừng bán' : 'Mở bán lại'}
        </Button>
      </td>
    </tr>
  );
}
