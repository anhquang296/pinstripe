import { useCallback, useState } from 'react';
import Button from '@components/ui/Button';
import LedgerAccountItem from '@components/LedgerAccountItem';
import LedgerTransactionItem from '@components/LedgerTransactionItem';
import TextField from '@components/ui/TextField';
import {
  useLedgerAccountsQuery,
  useLedgerTransactionsQuery,
  useReverseLedgerTransactionMutation,
} from '@reactquery/ledger';

const ACCOUNT_LIMIT = 20;
const TRANSACTION_LIMIT = 20;

export default function LedgerPage() {
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const accountsQuery = useLedgerAccountsQuery({ limit: ACCOUNT_LIMIT }, { hasPlaceholder: true });
  const transactionsQuery = useLedgerTransactionsQuery(
    { limit: TRANSACTION_LIMIT },
    { hasPlaceholder: true },
  );
  const reverseMutation = useReverseLedgerTransactionMutation();

  const handleOnTransactionSelect = useCallback((transactionId: string) => {
    setSelectedTransactionId((current) => (current === transactionId ? null : transactionId));
  }, []);

  const handleOnReasonChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setReason(event.target.value);
  }, []);

  const handleOnReverseConfirm = useCallback(async () => {
    if (!selectedTransactionId || reason.trim().length === 0) {
      return;
    }

    await reverseMutation.mutateAsync({
      id: selectedTransactionId,
      payload: { reason: reason.trim() },
    });

    setSelectedTransactionId(null);
    setReason('');
  }, [reason, reverseMutation, selectedTransactionId]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Ledger</h1>
        <p className="text-sm text-slate-500">
          Sổ kép append-only: số dư là projection của postings, sửa sai bằng bút toán đảo.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Số dư tài khoản
        </h2>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Tài khoản</th>
                <th className="px-4 py-3">Loại</th>
                <th className="px-4 py-3">Khách hàng</th>
                <th className="px-4 py-3 text-right">Nợ</th>
                <th className="px-4 py-3 text-right">Có</th>
                <th className="px-4 py-3 text-right">Số dư</th>
              </tr>
            </thead>
            <tbody>
              {accountsQuery.data?.data.map((account) => (
                <LedgerAccountItem key={account.id} account={account} />
              ))}
            </tbody>
          </table>
          {accountsQuery.error ? (
            <p className="px-4 py-3 text-red-600">{accountsQuery.error.message}</p>
          ) : null}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Bút toán gần đây
        </h2>

        {selectedTransactionId ? (
          <div className="flex flex-wrap items-end gap-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <TextField
              label={`Lý do đảo ${selectedTransactionId}`}
              placeholder="Phát hành nhầm kỳ"
              value={reason}
              onChange={handleOnReasonChange}
            />
            <Button onClick={handleOnReverseConfirm} disabled={reverseMutation.isPending}>
              Xác nhận đảo
            </Button>
          </div>
        ) : null}

        <ul className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {transactionsQuery.data?.data.map((transaction) => (
            <LedgerTransactionItem
              key={transaction.id}
              transaction={transaction}
              isSelected={selectedTransactionId === transaction.id}
              onSelect={handleOnTransactionSelect}
            />
          ))}
        </ul>
        {transactionsQuery.error ? (
          <p className="px-4 py-3 text-red-600">{transactionsQuery.error.message}</p>
        ) : null}
      </section>
    </div>
  );
}
