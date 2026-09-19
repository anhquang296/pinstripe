import DetailList from '@components/DetailList';
import DrawerSection from '@components/DrawerSection';
import EntityDrawer from '@components/EntityDrawer';
import FilterSelect from '@components/FilterSelect';
import MeterEventBatchForm from '@components/MeterEventBatchForm';
import MeterEventForm from '@components/MeterEventForm';
import MeterForm from '@components/MeterForm';
import StatGrid from '@components/StatGrid';
import StatItem from '@components/StatItem';
import StatusChip from '@components/StatusChip';
import { OPTION_LIMIT } from '@constants/pagination';
import { MILLISECONDS_PER_DAY } from '@constants/time';
import type { MeterEventBatchFormData } from '@forms/meter-event-batch-form';
import {
  meterEventBatchFormDataToPayload,
  meterEventBatchFormDefaultValues,
  meterEventBatchFormResolver,
} from '@forms/meter-event-batch-form';
import type { MeterEventFormData } from '@forms/meter-event-form';
import {
  meterEventFormDataToPayload,
  meterEventFormDefaultValues,
  meterEventFormResolver,
} from '@forms/meter-event-form';
import type { MeterFormData } from '@forms/meter-form';
import {
  meterFormDataToUpdatePayload,
  meterFormDefaultValues,
  meterFormResolver,
  meterToFormData,
} from '@forms/meter-form';
import { Button } from '@heroui/react';
import { formatDate } from '@lib/format';
import { useCan } from '@lib/permissions';
import { MeterStatusEnum, PermissionEnum } from '@pinstripe/core/contracts';
import {
  useCreateMeterEventBatchMutation,
  useCreateMeterEventMutation,
  useCustomersQuery,
  useMeterEventSummaryQuery,
  useMeterQuery,
  useUpdateMeterMutation,
} from '@pinstripe/sdk/react';
import { get, map } from 'lodash-es';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

const USAGE_WINDOW_DAYS = 30;

function buildUsageWindow(): { windowStart: string; windowEnd: string } {
  const now = Date.now();

  return {
    windowStart: new Date(now - USAGE_WINDOW_DAYS * MILLISECONDS_PER_DAY).toISOString(),
    windowEnd: new Date(now + MILLISECONDS_PER_DAY).toISOString(),
  };
}

interface MeterDrawerProps {
  meterId: string;
  onClose: () => void;
}

export default function MeterDrawer({ meterId, onClose }: MeterDrawerProps) {
  const [summaryCustomerId, setSummaryCustomerId] = useState('');
  const canWriteCatalog = useCan(PermissionEnum.CATALOG_WRITE);
  const canWriteSubscription = useCan(PermissionEnum.SUBSCRIPTION_WRITE);

  const { data: meter } = useMeterQuery(meterId);
  const { data: customers } = useCustomersQuery({ limit: OPTION_LIMIT });

  const [usageWindow] = useState(buildUsageWindow);
  const { data: summary } = useMeterEventSummaryQuery(
    meterId,
    { ...usageWindow, customerId: summaryCustomerId },
    { enabled: Boolean(summaryCustomerId) },
  );

  const { mutateAsync: updateMeter, isPending: isSaving } = useUpdateMeterMutation({
    successMessage: 'Đã cập nhật meter.',
  });
  const { mutateAsync: createMeterEvent, isPending: isSending } = useCreateMeterEventMutation({
    successMessage: 'Đã ghi nhận usage event.',
  });
  const { mutateAsync: createMeterEventBatch, isPending: isSendingBatch } =
    useCreateMeterEventBatchMutation({ successMessage: 'Đã gửi batch event.' });

  const meterForm = useForm<MeterFormData>({
    resolver: meterFormResolver,
    defaultValues: meterFormDefaultValues,
  });
  const eventForm = useForm<MeterEventFormData>({
    resolver: meterEventFormResolver,
    defaultValues: meterEventFormDefaultValues,
  });
  const batchForm = useForm<MeterEventBatchFormData>({
    resolver: meterEventBatchFormResolver,
    defaultValues: meterEventBatchFormDefaultValues,
  });

  useEffect(() => {
    if (meter) {
      meterForm.reset(meterToFormData(meter));
    }
  }, [meter, meterForm]);

  const eventName = get(meter, 'eventName', '');
  const valueKey = get(meter, 'valueKey', 'value');
  const status = get(meter, 'status', MeterStatusEnum.ACTIVE);

  const customerOptions = map(get(customers, 'data', []), (customer) => {
    return { value: customer.id, label: customer.name || customer.id };
  });

  const handleOnSave = meterForm.handleSubmit(async (formData) => {
    await updateMeter({ id: meterId, payload: meterFormDataToUpdatePayload(formData) });
  });

  const handleOnToggleStatus = async () => {
    const nextStatus =
      status === MeterStatusEnum.ACTIVE ? MeterStatusEnum.INACTIVE : MeterStatusEnum.ACTIVE;

    await updateMeter({ id: meterId, payload: { status: nextStatus } });
  };

  const handleOnSendEvent = eventForm.handleSubmit(async (formData) => {
    await createMeterEvent(meterEventFormDataToPayload(eventName, valueKey, formData));
    eventForm.reset(meterEventFormDefaultValues);
  });

  const handleOnSendBatch = batchForm.handleSubmit(async (formData) => {
    await createMeterEventBatch(meterEventBatchFormDataToPayload(eventName, valueKey, formData));
    batchForm.reset(meterEventBatchFormDefaultValues);
  });

  return (
    <EntityDrawer
      isOpen
      title={get(meter, 'displayName', meterId)}
      description={eventName}
      footer={
        <>
          <Button variant="ghost" onPress={onClose}>
            Đóng
          </Button>
          {canWriteCatalog ? (
            <Button variant="ghost" isDisabled={isSaving} onPress={handleOnToggleStatus}>
              {status === MeterStatusEnum.ACTIVE ? 'Tắt meter' : 'Bật lại meter'}
            </Button>
          ) : null}
        </>
      }
      onOpenChange={onClose}
    >
      <div className="flex flex-col gap-4">
        <DrawerSection title="Tóm tắt">
          <DetailList
            items={[
              { label: 'ID', value: meterId },
              { label: 'Event', value: eventName },
              { label: 'Tổng hợp', value: get(meter, 'aggregation', '—') },
              { label: 'Khóa giá trị', value: valueKey },
              { label: 'Trạng thái', value: <StatusChip status={status} /> },
              { label: 'Tạo lúc', value: formatDate(get(meter, 'createdAt', '')) },
            ]}
          />
        </DrawerSection>

        {canWriteCatalog ? (
          <DrawerSection title="Sửa meter">
            <MeterForm mode="edit" form={meterForm} isSaving={isSaving} onSave={handleOnSave} />
          </DrawerSection>
        ) : null}

        <DrawerSection
          title={`Lượng dùng ${USAGE_WINDOW_DAYS} ngày gần nhất`}
          actions={
            <FilterSelect
              label="Khách hàng"
              options={customerOptions}
              selectedValue={summaryCustomerId}
              onSelect={setSummaryCustomerId}
            />
          }
        >
          {summary ? (
            <StatGrid>
              <StatItem label="Giá trị" value={summary.value.toLocaleString('vi-VN')} />
              <StatItem label="Số event" value={summary.eventCount} />
              <StatItem label="Từ" value={formatDate(summary.windowStart)} />
              <StatItem label="Đến" value={formatDate(summary.windowEnd)} />
            </StatGrid>
          ) : (
            <span className="text-app-label text-[13px]">
              Chọn một khách hàng để xem tổng hợp lượng dùng.
            </span>
          )}
        </DrawerSection>

        {canWriteSubscription ? (
          <DrawerSection title="Bắn một event">
            <MeterEventForm
              form={eventForm}
              customerOptions={customerOptions}
              isSaving={isSending}
              onSave={handleOnSendEvent}
            />
          </DrawerSection>
        ) : null}

        {canWriteSubscription ? (
          <DrawerSection title="Gửi batch event">
            <MeterEventBatchForm
              form={batchForm}
              customerOptions={customerOptions}
              isSaving={isSendingBatch}
              onSave={handleOnSendBatch}
            />
          </DrawerSection>
        ) : null}
      </div>
    </EntityDrawer>
  );
}
