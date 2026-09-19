import { Button, Input, Label, ListBox, Select, TextField } from '@heroui/react';
import { map } from 'lodash-es';

interface InvoiceDraftPanelProps {
  subscriptionOptions: { value: string; label: string }[];
  selectedSubscriptionId: string;
  creditAmount: string;
  isCreating: boolean;
  onSubscriptionChange: (subscriptionId: unknown) => void;
  onCreditAmountChange: (creditAmount: string) => void;
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
    <div className="border-app-border-soft flex flex-wrap items-end gap-4 rounded-md border bg-surface p-4">
      <Select
        className="flex flex-col gap-1"
        placeholder="— chọn subscription —"
        selectedKey={selectedSubscriptionId === '' ? null : selectedSubscriptionId}
        onSelectionChange={onSubscriptionChange}
      >
        <Label>Subscription</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {map(subscriptionOptions, (subscriptionOption) => {
              return (
                <ListBox.Item key={subscriptionOption.value} id={subscriptionOption.value}>
                  {subscriptionOption.label}
                </ListBox.Item>
              );
            })}
          </ListBox>
        </Select.Popover>
      </Select>
      <Button onPress={onDraft} isDisabled={isCreating || !selectedSubscriptionId}>
        Tạo hóa đơn nháp
      </Button>
      <TextField
        className="flex w-40 flex-col gap-1"
        value={creditAmount}
        onChange={onCreditAmountChange}
      >
        <Label>Số tiền credit note</Label>
        <Input type="number" />
      </TextField>
    </div>
  );
}
