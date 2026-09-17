import Button from '@components/ui/Button';
import SelectField from '@components/ui/SelectField';
import TextField from '@components/ui/TextField';

interface InvoiceDraftPanelProps {
  subscriptionOptions: { value: string; label: string }[];
  selectedSubscriptionId: string;
  creditAmount: string;
  isCreating: boolean;
  onSubscriptionChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  onCreditAmountChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDraft: () => void;
}

export default function InvoiceDraftPanel({
  subscriptionOptions,
  selectedSubscriptionId,
  creditAmount,
  isCreating,
  onSubscriptionChange,
  onCreditAmountChange,
  onDraft,
}: InvoiceDraftPanelProps) {
  return (
    <div className="flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-4">
      <SelectField
        label="Subscription"
        options={subscriptionOptions}
        value={selectedSubscriptionId}
        onChange={onSubscriptionChange}
      />
      <Button onClick={onDraft} disabled={isCreating || !selectedSubscriptionId}>
        Tạo hóa đơn nháp
      </Button>
      <TextField
        label="Số tiền credit note"
        type="number"
        className="w-40"
        value={creditAmount}
        onChange={onCreditAmountChange}
      />
    </div>
  );
}
