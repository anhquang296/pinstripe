import type { CustomerResponse } from '@pinstripe/core/contracts';

interface CustomerItemProps {
  customer: CustomerResponse;
}

export default function CustomerItem({ customer }: CustomerItemProps) {
  const { email } = customer;

  return (
    <tr className="border-t border-slate-100">
      <td className="px-4 py-3 font-mono text-xs text-slate-500">{customer.id}</td>
      <td className="px-4 py-3">{customer.name || '—'}</td>
      <td className="px-4 py-3 text-slate-600">{email === null ? '—' : email}</td>
      <td className="px-4 py-3 uppercase">{customer.currency}</td>
      <td className="px-4 py-3 text-slate-500">
        {new Date(customer.createdAt).toLocaleString('vi-VN')}
      </td>
    </tr>
  );
}
