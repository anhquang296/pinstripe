import type { LedgerAccountResponse } from '@pinstripe/core/contracts';
import { toUpper } from 'lodash-es';

interface LedgerAccountItemProps {
  account: LedgerAccountResponse;
}

export default function LedgerAccountItem({ account }: LedgerAccountItemProps) {
  const { customerId } = account;

  return (
    <tr className="border-t border-slate-100">
      <td className="px-4 py-3 font-medium">{account.code}</td>
      <td className="px-4 py-3 text-slate-600">{account.type}</td>
      <td className="px-4 py-3 font-mono text-xs text-slate-500">
        {customerId === null ? '—' : customerId}
      </td>
      <td className="px-4 py-3 text-right tabular-nums">
        {account.debits.toLocaleString('vi-VN')}
      </td>
      <td className="px-4 py-3 text-right tabular-nums">
        {account.credits.toLocaleString('vi-VN')}
      </td>
      <td className="px-4 py-3 text-right font-medium tabular-nums">
        {account.balance.toLocaleString('vi-VN')} {toUpper(account.currency)}
      </td>
    </tr>
  );
}
