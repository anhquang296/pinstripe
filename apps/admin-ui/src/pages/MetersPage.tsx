import type { GetMeterEventSummariesQuery } from '@api/meters';
import MeterForm from '@components/MeterForm';
import MeterItem from '@components/MeterItem';
import Button from '@components/ui/Button';
import SelectField from '@components/ui/SelectField';
import TextField from '@components/ui/TextField';
import type { MeterFormData } from '@forms/meter-form';
import {
  meterFormDataToPayload,
  meterFormDefaultValues,
  meterFormResolver,
} from '@forms/meter-form';
import { useCustomersQuery } from '@reactquery/customers';
import {
  useCreateMeterEventMutation,
  useCreateMeterMutation,
  useMeterEventSummaryQuery,
  useMetersQuery,
} from '@reactquery/meters';
import { find, map } from 'lodash-es';
import { useCallback, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';

const PAGE_LIMIT = 20;
const OPTION_LIMIT = 100;
const USAGE_WINDOW_DAYS = 30;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function buildUsageWindow(customerId: string): GetMeterEventSummariesQuery {
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
  const [usageWindow, setUsageWindow] = useState<GetMeterEventSummariesQuery>(() => {
    return buildUsageWindow('');
  });

  const { data: meters, error } = useMetersQuery({ limit: PAGE_LIMIT }, { hasPlaceholder: true });
  const { data: customers } = useCustomersQuery({ limit: OPTION_LIMIT });
  const { mutateAsync: createMeter, isPending: isSaving } = useCreateMeterMutation();
  const { mutateAsync: createMeterEvent, isPending: isSending } = useCreateMeterEventMutation();

  const { data: summary } = useMeterEventSummaryQuery(selectedMeterId, usageWindow, {
    enabled: Boolean(selectedMeterId) && Boolean(selectedCustomerId),
  });

  const form = useForm<MeterFormData>({
    resolver: meterFormResolver,
    defaultValues: meterFormDefaultValues,
  });

  const meterOptions = useMemo(() => {
    return [
      { value: '', label: '— chọn meter —' },
      ...map(meters?.data, (meter) => {
        return { value: meter.id, label: `${meter.displayName} (${meter.eventName})` };
      }),
    ];
  }, [meters]);

  const customerOptions = useMemo(() => {
    return [
      { value: '', label: '— chọn khách hàng —' },
      ...map(customers?.data, (customer) => {
        return { value: customer.id, label: customer.name || customer.email || customer.id };
      }),
    ];
  }, [customers]);

  const handleOnSave = form.handleSubmit(async (formData) => {
    await createMeter(meterFormDataToPayload(formData));
    form.reset(meterFormDefaultValues);
  });

  const handleOnMeterChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedMeterId(event.target.value);
  }, []);

  const handleOnCustomerChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCustomerId(event.target.value);
    setUsageWindow(buildUsageWindow(event.target.value));
  }, []);

  const handleOnValueChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setEventValue(event.target.value);
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
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Meters</h1>
        <p className="text-sm text-slate-500">
          Event thô là append-only. Tổng hợp tính lúc đọc, nên đổi cách tính giá vẫn dựng lại được
          số cũ.
        </p>
      </div>

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
          <SelectField
            label="Meter"
            options={meterOptions}
            value={selectedMeterId}
            onChange={handleOnMeterChange}
          />
          <SelectField
            label="Khách hàng"
            options={customerOptions}
            value={selectedCustomerId}
            onChange={handleOnCustomerChange}
          />
          <TextField
            label="Giá trị"
            type="number"
            className="w-24"
            value={eventValue}
            onChange={handleOnValueChange}
          />
          <Button variant="ghost" onClick={handleOnSendEvent} disabled={isSending}>
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
    </div>
  );
}
