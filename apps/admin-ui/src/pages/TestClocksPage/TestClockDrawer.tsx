import AdvanceTestClockForm from '@components/AdvanceTestClockForm';
import DetailList from '@components/DetailList';
import DrawerSection from '@components/DrawerSection';
import EntityDrawer from '@components/EntityDrawer';
import StatusChip from '@components/StatusChip';
import type { AdvanceTestClockFormData } from '@forms/advance-test-clock-form';
import {
  advanceTestClockFormDataToPayload,
  advanceTestClockFormDefaultValues,
  advanceTestClockFormResolver,
} from '@forms/advance-test-clock-form';
import { Button } from '@heroui/react';
import { formatDate } from '@lib/format';
import { useCan } from '@lib/permissions';
import { PermissionEnum, TestClockStatusEnum } from '@pinstripe/core/contracts';
import { useAdvanceTestClockMutation, useTestClockQuery } from '@pinstripe/sdk/react';
import { get } from 'lodash-es';
import { useForm } from 'react-hook-form';

interface TestClockDrawerProps {
  testClockId: string;
  onClose: () => void;
}

export default function TestClockDrawer({ testClockId, onClose }: TestClockDrawerProps) {
  const canWrite = useCan(PermissionEnum.TEST_CLOCK_WRITE);

  const { data: testClock } = useTestClockQuery(testClockId);
  const { mutateAsync: advanceTestClock, isPending: isSaving } = useAdvanceTestClockMutation({
    successMessage: 'Đã tua đồng hồ.',
  });

  const form = useForm<AdvanceTestClockFormData>({
    resolver: advanceTestClockFormResolver,
    defaultValues: advanceTestClockFormDefaultValues,
  });

  const handleOnSave = form.handleSubmit(async (formData) => {
    await advanceTestClock({
      id: testClockId,
      payload: advanceTestClockFormDataToPayload(formData),
    });
    form.reset(advanceTestClockFormDefaultValues);
  });

  return (
    <EntityDrawer
      isOpen
      title={get(testClock, 'name', testClockId)}
      description={testClockId}
      footer={
        <Button variant="ghost" onPress={onClose}>
          Đóng
        </Button>
      }
      onOpenChange={onClose}
    >
      <div className="flex flex-col gap-4">
        <DrawerSection title="Tóm tắt">
          <DetailList
            items={[
              {
                label: 'Trạng thái',
                value: <StatusChip status={get(testClock, 'status', TestClockStatusEnum.READY)} />,
              },
              { label: 'Đang đứng ở', value: formatDate(get(testClock, 'frozenTime', '')) },
              { label: 'Tạo lúc', value: formatDate(get(testClock, 'createdAt', '')) },
            ]}
          />
        </DrawerSection>

        {canWrite ? (
          <DrawerSection title="Tua đồng hồ">
            <AdvanceTestClockForm form={form} isSaving={isSaving} onSave={handleOnSave} />
          </DrawerSection>
        ) : null}
      </div>
    </EntityDrawer>
  );
}
