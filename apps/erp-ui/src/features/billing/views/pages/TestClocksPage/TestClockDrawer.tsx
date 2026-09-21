import DetailList from '@common/components/DetailList';
import DrawerSection from '@common/components/DrawerSection';
import EntityDrawer from '@common/components/EntityDrawer';
import StatusChip from '@common/components/StatusChip';
import type { AdvanceTestClockFormData } from '@common/forms/advance-test-clock-form';
import {
  advanceTestClockFormDataToPayload,
  advanceTestClockFormDefaultValues,
  advanceTestClockFormResolver,
} from '@common/forms/advance-test-clock-form';
import { formatDate } from '@common/utils/format';
import AdvanceTestClockForm from '@features/billing/components/AdvanceTestClockForm';
import { Button } from '@heroui/react';
import { useCan } from '@libs/permissions';
import { TestClockStatusEnum } from '@vxrerp/billing/contracts';
import { PermissionEnum } from '@vxrerp/platform/contracts';
import { useAdvanceTestClockMutation, useTestClockQuery } from '@vxrerp/sdk/react';
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
