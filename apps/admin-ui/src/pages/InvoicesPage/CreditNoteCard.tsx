import type { CreditNoteResponse } from '@pinstripe/sdk';
import { map, toUpper } from 'lodash-es';

interface CreditNoteCardProps {
  creditNotes: readonly CreditNoteResponse[];
}

export default function CreditNoteCard({ creditNotes }: CreditNoteCardProps) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Credit notes</h2>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Số</th>
              <th className="px-4 py-3">Hóa đơn</th>
              <th className="px-4 py-3">Lý do</th>
              <th className="px-4 py-3 text-right">Số tiền</th>
            </tr>
          </thead>
          <tbody>
            {map(creditNotes, (creditNote) => {
              return (
                <tr key={creditNote.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-mono text-xs">{creditNote.number}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">
                    {creditNote.invoiceId}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{creditNote.reason}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {creditNote.amount.toLocaleString('vi-VN')} {toUpper(creditNote.currency)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
