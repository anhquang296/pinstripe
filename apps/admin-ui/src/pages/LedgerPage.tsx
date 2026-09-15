import LedgerAccountItem from '@components/LedgerAccountItem';
import LedgerTransactionItem from '@components/LedgerTransactionItem';
import ReverseTransactionForm from '@components/ReverseTransactionForm';
import type { ReverseTransactionFormData } from '@forms/reverse-transaction-form';
import {
  reverseTransactionFormDataToPayload,
  reverseTransactionFormDefaultValues,
  reverseTransactionFormResolver,
} from '@forms/reverse-transaction-form';
import {
  useLedgerAccountsQuery,
  useLedgerTransactionsQuery,
  useReverseLedgerTransactionMutation,
} from '@reactquery/ledger';
import { map } from 'lodash-es';
import { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';

const ACCOUNT_LIMIT = 20;
const TRANSACTION_LIMIT = 20;

export default function LedgerPage() {
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const { data: ledgerAccounts, error: accountsError } = useLedgerAccountsQuery(
    { limit: ACCOUNT_LIMIT },
    { hasPlaceholder: true },
  );
  const { data: ledgerTransactions, error: transactionsError } = useLedgerTransactionsQuery(
    { limit: TRANSACTION_LIMIT },
    { hasPlaceholder: true },
  );
  const { mutateAsync: reverseLedgerTransaction, isPending: isReversing } =
    useReverseLedgerTransactionMutation();
  const form = useForm<ReverseTransactionFormData>({
    resolver: reverseTransactionFormResolver,
    defaultValues: reverseTransactionFormDefaultValues,
  });

  const handleOnTransactionSelect = useCallback((transactionId: string) => {
    setSelectedTransactionId((current) => {
      return current === transactionId ? null : transactionId;
    });
  }, []);

  const handleOnSave = form.handleSubmit(async (formData) => {
    if (!selectedTransactionId) {
      return;
    }

    await reverseLedgerTransaction({
      id: selectedTransactionId,
      payload: reverseTransactionFormDataToPayload(formData),
    });

    setSelectedTransactionId(null);
    form.reset(reverseTransactionFormDefaultValues);
  });

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
              {map(ledgerAccounts?.data, (account) => {
                return <LedgerAccountItem key={account.id} account={account} />;
              })}
            </tbody>
          </table>
          {accountsError ? <p className="px-4 py-3 text-red-600">{accountsError.message}</p> : null}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Bút toán gần đây
        </h2>

        {selectedTransactionId ? (
          <ReverseTransactionForm
            form={form}
            transactionId={selectedTransactionId}
            isSaving={isReversing}
            onSave={handleOnSave}
          />
        ) : null}

        <ul className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {map(ledgerTransactions?.data, (transaction) => {
            return (
              <LedgerTransactionItem
                key={transaction.id}
                transaction={transaction}
                isSelected={selectedTransactionId === transaction.id}
                onSelect={handleOnTransactionSelect}
              />
            );
          })}
        </ul>
        {transactionsError ? (
          <p className="px-4 py-3 text-red-600">{transactionsError.message}</p>
        ) : null}
      </section>
    </div>
  );
}
