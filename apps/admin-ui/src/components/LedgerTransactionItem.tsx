import Button from '@components/ui/Button';
import type { LedgerTransactionResponse } from '@pinstripe/core/contracts';
import { map, toUpper } from 'lodash-es';
import { useCallback } from 'react';

interface LedgerTransactionItemProps {
  transaction: LedgerTransactionResponse;
  isSelected: boolean;
  onSelect: (transactionId: string) => void;
}

export default function LedgerTransactionItem({
  transaction,
  isSelected,
  onSelect,
}: LedgerTransactionItemProps) {
  const handleOnSelectClick = useCallback(() => {
    onSelect(transaction.id);
  }, [onSelect, transaction.id]);

  return (
    <li className="flex flex-col gap-3 border-t border-slate-100 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="font-medium">{transaction.description}</span>
          <span className="font-mono text-xs text-slate-500">
            {transaction.id} · {new Date(transaction.effectiveAt).toLocaleString('vi-VN')}
          </span>
        </div>

        {transaction.reversedByTransactionId ? (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
            đã bị đảo
          </span>
        ) : (
          <Button variant={isSelected ? 'primary' : 'ghost'} onClick={handleOnSelectClick}>
            Đảo bút toán
          </Button>
        )}
      </div>

      <table className="w-full text-left text-sm">
        <tbody>
          {map(transaction.postings, (posting) => {
            return (
              <tr key={posting.id} className="text-slate-600">
                <td className="py-1">{posting.accountCode}</td>
                <td className="py-1">
                  <span
                    className={
                      posting.direction === 'debit'
                        ? 'rounded bg-sky-50 px-2 py-0.5 text-xs text-sky-700'
                        : 'rounded bg-violet-50 px-2 py-0.5 text-xs text-violet-700'
                    }
                  >
                    {posting.direction}
                  </span>
                </td>
                <td className="py-1 text-right tabular-nums">
                  {posting.amount.toLocaleString('vi-VN')} {toUpper(posting.currency)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </li>
  );
}
