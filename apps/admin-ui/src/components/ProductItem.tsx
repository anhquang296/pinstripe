import type { ProductResponse } from '@pinstripe/core/contracts';

interface ProductItemProps {
  product: ProductResponse;
}

export default function ProductItem({ product }: ProductItemProps) {
  return (
    <tr className="border-t border-slate-100">
      <td className="px-4 py-3 font-mono text-xs text-slate-500">{product.id}</td>
      <td className="px-4 py-3">{product.name}</td>
      <td className="px-4 py-3 text-slate-600">{product.description || '—'}</td>
      <td className="px-4 py-3">
        <span
          className={
            product.active
              ? 'rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700'
              : 'rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600'
          }
        >
          {product.active ? 'active' : 'archived'}
        </span>
      </td>
    </tr>
  );
}
