import DataTable from '@common/components/DataTable';
import DrawerSection from '@common/components/DrawerSection';
import EntityDrawer from '@common/components/EntityDrawer';
import FilterBar from '@common/components/FilterBar';
import PageCard from '@common/components/PageCard';
import StatGrid from '@common/components/StatGrid';
import StatItem from '@common/components/StatItem';
import StatusChip from '@common/components/StatusChip';
import { PAGE_LIMIT } from '@common/constants/pagination';
import type { TestClockFormData } from '@common/forms/test-clock-form';
import {
  testClockFormDataToPayload,
  testClockFormDefaultValues,
  testClockFormResolver,
} from '@common/forms/test-clock-form';
import { useCursorPagination } from '@common/hooks/useCursorPagination';
import { formatDate } from '@common/utils/format';
import TestClockForm from '@features/dashboard/components/TestClockForm';
import { Button } from '@heroui/react';
import { useCan } from '@libs/permissions';
import type { TestClockResponse } from '@pinstripe/core/contracts';
import { PermissionEnum, TestClockStatusEnum } from '@pinstripe/core/contracts';
import { useCreateTestClockMutation, useTestClocksQuery } from '@pinstripe/sdk/react';
import { filter, get, last, size } from 'lodash-es';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';

import TestClockDrawer from './TestClockDrawer';

export default function TestClocksPage() {
  const { testClockId } = useParams();
  const navigate = useNavigate();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { after, hasPrevious, advancePage, revertPage } = useCursorPagination();
  const canWrite = useCan(PermissionEnum.TEST_CLOCK_WRITE);

  const {
    data: testClocks,
    isPending,
    error,
  } = useTestClocksQuery({ limit: PAGE_LIMIT, after }, { hasPlaceholder: true });

  const { mutateAsync: createTestClock, isPending: isSaving } = useCreateTestClockMutation({
    successMessage: 'Đã tạo test clock.',
  });

  const form = useForm<TestClockFormData>({
    resolver: testClockFormResolver,
    defaultValues: testClockFormDefaultValues,
  });

  const rows = get(testClocks, 'data', []);
  const hasMore = get(testClocks, 'hasMore', false);
  const isDisabled = get(error, 'statusCode') === 404;

  const handleOnSave = form.handleSubmit(async (formData) => {
    await createTestClock(testClockFormDataToPayload(formData));
    form.reset(testClockFormDefaultValues);
    setIsCreateOpen(false);
  });

  const handleOnNext = () => {
    const lastTestClock = last(rows);

    if (lastTestClock) {
      advancePage(lastTestClock.id);
    }
  };

  const handleOnRowAction = (testClock: TestClockResponse) => {
    navigate(`/test-clocks/${testClock.id}`);
  };

  if (isDisabled) {
    return (
      <PageCard
        title="Test clocks"
        description="Test clock đang tắt ở môi trường này. Bật bằng TEST_CLOCKS_ENABLED=true trên UAT/staging."
      >
        <p className="text-[13px] text-muted">Không có gì để hiển thị.</p>
      </PageCard>
    );
  }

  return (
    <PageCard
      title="Test clocks"
      description="Tua thời gian để thấy trial kết thúc, kỳ cuốn sang kỳ mới và subscription hủy cuối kỳ."
      actions={
        canWrite ? (
          <Button
            onPress={() => {
              setIsCreateOpen(true);
            }}
          >
            Tạo test clock
          </Button>
        ) : null
      }
    >
      <StatGrid>
        <StatItem label="Đồng hồ trang này" value={size(rows)} />
        <StatItem
          label="Sẵn sàng"
          value={size(filter(rows, { status: TestClockStatusEnum.READY }))}
        />
        <StatItem
          label="Đang tua"
          value={size(filter(rows, { status: TestClockStatusEnum.ADVANCING }))}
        />
        <StatItem label="Mốc gần nhất" value={formatDate(get(rows, '0.frozenTime', ''))} />
      </StatGrid>

      <DataTable
        toolbar={<FilterBar itemCount={size(rows)} />}
        label="Danh sách test clock"
        rows={rows}
        isLoading={isPending}
        hasMore={hasMore}
        hasPrevious={hasPrevious}
        emptyMessage="Chưa có test clock nào."
        onRowAction={handleOnRowAction}
        onNext={handleOnNext}
        onPrevious={revertPage}
        columns={[
          {
            key: 'name',
            label: 'Đồng hồ',
            isRowHeader: true,
            renderCell: (testClock) => {
              return (
                <div className="flex flex-col">
                  <span className="font-medium">{testClock.name}</span>
                  <span className="text-app-label font-mono text-[11px]">{testClock.id}</span>
                </div>
              );
            },
          },
          {
            key: 'frozenTime',
            label: 'Đang đứng ở',
            renderCell: (testClock) => {
              return formatDate(testClock.frozenTime);
            },
          },
          {
            key: 'status',
            label: 'Trạng thái',
            renderCell: (testClock) => {
              return <StatusChip status={testClock.status} />;
            },
          },
          {
            key: 'createdAt',
            label: 'Tạo lúc',
            renderCell: (testClock) => {
              return formatDate(testClock.createdAt);
            },
          },
        ]}
      />

      <EntityDrawer
        isOpen={isCreateOpen}
        title="Tạo test clock"
        description="Đồng hồ đứng ở mốc bạn chọn cho tới khi được tua tới mốc mới."
        onOpenChange={setIsCreateOpen}
      >
        <DrawerSection title="Thông tin test clock">
          <TestClockForm form={form} isSaving={isSaving} onSave={handleOnSave} />
        </DrawerSection>
      </EntityDrawer>

      {testClockId ? (
        <TestClockDrawer
          testClockId={testClockId}
          onClose={() => {
            navigate('/test-clocks');
          }}
        />
      ) : null}
    </PageCard>
  );
}
