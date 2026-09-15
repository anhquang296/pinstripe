import type { Customer } from '@pinstripe/core/contracts';

export interface CustomerItemProps {
  customer: Customer;
}

export default function CustomerItem({ customer }: CustomerItemProps) {
  return (
    <tr className="border-t border-slate-100">
      <td className="px-4 py-3 font-mono text-xs text-slate-500">{customer.id}</td>
      <td className="px-4 py-3">{customer.name || '—'}</td>
      <td className="px-4 py-3 text-slate-600">{customer.email ?? '—'}</td>
      <td className="px-4 py-3 uppercase">{customer.currency}</td>
      <td className="px-4 py-3 text-slate-500">
        {new Date(customer.createdAt).toLocaleString('vi-VN')}
      </td>
    </tr>
  );
}
