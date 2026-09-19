import MeterForm from '@components/MeterForm';
import MeterItem from '@components/MeterItem';
import PageCard from '@components/PageCard';
import { OPTION_LIMIT, PAGE_LIMIT } from '@constants/pagination';
import { MILLISECONDS_PER_DAY } from '@constants/time';
import type { MeterFormData } from '@forms/meter-form';
import {
  meterFormDataToPayload,
  meterFormDefaultValues,
  meterFormResolver,
} from '@forms/meter-form';
import { Button, Input, Label, ListBox, Select, TextField } from '@heroui/react';
import type { GetMeterEventSummaryQuery } from '@pinstripe/sdk';
import {
  useCreateMeterEventMutation,
  useCreateMeterMutation,
  useCustomersQuery,
  useMeterEventSummaryQuery,
  useMetersQuery,
} from '@pinstripe/sdk/react';
import { find, map, toString } from 'lodash-es';
import { useCallback, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';

const USAGE_WINDOW_DAYS = 30;

function buildUsageWindow(customerId: string): GetMeterEventSummaryQuery {
  const now = Date.now();

  return {
    customerId,
    windowStart: new Date(now - USAGE_WINDOW_DAYS * MILLISECONDS_PER_DAY).toISOString(),
    windowEnd: new Date(now + MILLISECONDS_PER_DAY).toISOString(),
  };
}

export default function MetersPage() {
  const [selectedMeterId, setSelectedMeterId] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [eventValue, setEventValue] = useState('1');
  const [usageWindow, setUsageWindow] = useState<GetMeterEventSummaryQuery>(() => {
    return buildUsageWindow('');
  });

  const { data: meters, error } = useMetersQuery({ limit: PAGE_LIMIT }, { hasPlaceholder: true });
  const { data: customers } = useCustomersQuery({ limit: OPTION_LIMIT });
  const { mutateAsync: createMeter, isPending: isSaving } = useCreateMeterMutation({
    successMessage: 'Đã tạo meter.',
  });
  const { mutateAsync: createMeterEvent, isPending: isSending } = useCreateMeterEventMutation({
    successMessage: 'Đã ghi nhận usage event.',
  });

  const { data: summary } = useMeterEventSummaryQuery(selectedMeterId, usageWindow, {
    enabled: Boolean(selectedMeterId) && Boolean(selectedCustomerId),
  });

  const form = useForm<MeterFormData>({
    resolver: meterFormResolver,
    defaultValues: meterFormDefaultValues,
  });

  const meterOptions = useMemo(() => {
    return map(meters?.data, (meter) => {
      return { value: meter.id, label: `${meter.displayName} (${meter.eventName})` };
    });
  }, [meters]);

  const customerOptions = useMemo(() => {
    return map(customers?.data, (customer) => {
      return { value: customer.id, label: customer.name || customer.email || customer.id };
    });
  }, [customers]);

  const handleOnSave = form.handleSubmit(async (formData) => {
    await createMeter(meterFormDataToPayload(formData));
    form.reset(meterFormDefaultValues);
  });

  const handleOnMeterChange = useCallback((key: unknown) => {
    setSelectedMeterId(toString(key));
  }, []);

  const handleOnCustomerChange = useCallback((key: unknown) => {
    const customerId = toString(key);

    setSelectedCustomerId(customerId);
    setUsageWindow(buildUsageWindow(customerId));
  }, []);

  const handleOnSendEvent = useCallback(async () => {
    const meter = find(meters?.data, { id: selectedMeterId });

    if (!meter || !selectedCustomerId) {
      return;
    }

    await createMeterEvent({
      eventName: meter.eventName,
      customerId: selectedCustomerId,
      payload: { [meter.valueKey]: Number(eventValue) },
    });
  }, [createMeterEvent, eventValue, meters, selectedCustomerId, selectedMeterId]);

  return (
    <PageCard
      title="Meters"
      description="Event thô là append-only. Tổng hợp tính lúc đọc, nên đổi cách tính giá vẫn dựng lại được số cũ."
    >
      <MeterForm form={form} isSaving={isSaving} onSave={handleOnSave} />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Tên</th>
              <th className="px-4 py-3">Event</th>
              <th className="px-4 py-3">Tổng hợp</th>
              <th className="px-4 py-3">Khóa giá trị</th>
              <th className="px-4 py-3">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {map(meters?.data, (meter) => {
              return <MeterItem key={meter.id} meter={meter} />;
            })}
          </tbody>
        </table>
        {error ? <p className="px-4 py-3 text-red-600">{error.message}</p> : null}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Usage {USAGE_WINDOW_DAYS} ngày gần nhất
        </h2>
        <div className="flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-4">
          <Select
            className="flex flex-col gap-1"
            placeholder="— chọn meter —"
            selectedKey={selectedMeterId === '' ? null : selectedMeterId}
            onSelectionChange={handleOnMeterChange}
          >
            <Label>Meter</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {map(meterOptions, (meterOption) => {
                  return (
                    <ListBox.Item key={meterOption.value} id={meterOption.value}>
                      {meterOption.label}
                    </ListBox.Item>
                  );
                })}
              </ListBox>
            </Select.Popover>
          </Select>
          <Select
            className="flex flex-col gap-1"
            placeholder="— chọn khách hàng —"
            selectedKey={selectedCustomerId === '' ? null : selectedCustomerId}
            onSelectionChange={handleOnCustomerChange}
          >
            <Label>Khách hàng</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {map(customerOptions, (customerOption) => {
                  return (
                    <ListBox.Item key={customerOption.value} id={customerOption.value}>
                      {customerOption.label}
                    </ListBox.Item>
                  );
                })}
              </ListBox>
            </Select.Popover>
          </Select>
          <TextField
            className="flex w-24 flex-col gap-1"
            value={eventValue}
            onChange={setEventValue}
          >
            <Label>Giá trị</Label>
            <Input type="number" />
          </TextField>
          <Button variant="ghost" onPress={handleOnSendEvent} isDisabled={isSending}>
            Bắn 1 event
          </Button>
          {summary ? (
            <div className="ml-auto flex flex-col text-right">
              <span className="text-2xl font-semibold tabular-nums">
                {summary.value.toLocaleString('vi-VN')}
              </span>
              <span className="text-xs text-slate-500">
                {summary.aggregation} · {summary.eventCount.toLocaleString('vi-VN')} event
              </span>
            </div>
          ) : null}
        </div>
      </section>
    </PageCard>
  );
}
