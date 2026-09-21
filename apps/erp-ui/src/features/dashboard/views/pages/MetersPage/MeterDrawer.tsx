import DetailList from '@common/components/DetailList';
import DrawerSection from '@common/components/DrawerSection';
import EntityDrawer from '@common/components/EntityDrawer';
import FilterSelect from '@common/components/FilterSelect';
import StatGrid from '@common/components/StatGrid';
import StatItem from '@common/components/StatItem';
import StatusChip from '@common/components/StatusChip';
import { OPTION_LIMIT } from '@common/constants/pagination';
import type { MeterEventBatchFormData } from '@common/forms/meter-event-batch-form';
import {
  meterEventBatchFormDataToPayload,
  meterEventBatchFormDefaultValues,
  meterEventBatchFormResolver,
} from '@common/forms/meter-event-batch-form';
import type { MeterEventFormData } from '@common/forms/meter-event-form';
import {
  meterEventFormDataToPayload,
  meterEventFormDefaultValues,
  meterEventFormResolver,
} from '@common/forms/meter-event-form';
import type { MeterFormData } from '@common/forms/meter-form';
import {
  meterFormDataToUpdatePayload,
  meterFormDefaultValues,
  meterFormResolver,
  meterToFormData,
} from '@common/forms/meter-form';
import { useReportRangeLabel, useReportWindow } from '@common/hooks/useReportWindow';
import { formatDate } from '@common/utils/format';
import MeterEventBatchForm from '@features/dashboard/components/MeterEventBatchForm';
import MeterEventForm from '@features/dashboard/components/MeterEventForm';
import MeterForm from '@features/dashboard/components/MeterForm';
import { Button } from '@heroui/react';
import { useCan } from '@libs/permissions';
import { MeterStatusEnum } from '@vxrerp/billing/contracts';
import { PermissionEnum } from '@vxrerp/platform/contracts';
import {
  useCreateMeterEventBatchMutation,
  useCreateMeterEventMutation,
  useCustomersQuery,
  useMeterEventSummaryQuery,
  useMeterQuery,
  useUpdateMeterMutation,
} from '@vxrerp/sdk/react';
import { get, isNull, map, toString } from 'lodash-es';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

interface MeterDrawerProps {
  meterId: string;
  onClose: () => void;
}

export default function MeterDrawer({ meterId, onClose }: MeterDrawerProps) {
  const [summaryCustomerId, setSummaryCustomerId] = useState<string | null>(null);

  const canWriteCatalog = useCan(PermissionEnum.CATALOG_WRITE);
  const canWriteSubscription = useCan(PermissionEnum.SUBSCRIPTION_WRITE);

  const { data: meter } = useMeterQuery(meterId);

  const { data: customers } = useCustomersQuery({ limit: OPTION_LIMIT });

  const usageWindow = useReportWindow();
  const usageRangeLabel = useReportRangeLabel();

  const { data: summary } = useMeterEventSummaryQuery(
    meterId,
    { ...usageWindow, customerId: toString(summaryCustomerId) },
    { enabled: !isNull(summaryCustomerId) },
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
          title={`Lượng dùng — ${usageRangeLabel}`}
          actions={
            <FilterSelect
              label="Khách hàng"
              placeholder="— chọn khách hàng —"
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
