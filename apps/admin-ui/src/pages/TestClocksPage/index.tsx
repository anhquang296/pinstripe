import DataTable from '@components/DataTable';
import EntityDrawer from '@components/EntityDrawer';
import FilterBar from '@components/FilterBar';
import PageCard from '@components/PageCard';
import StatGrid from '@components/StatGrid';
import StatItem from '@components/StatItem';
import StatusChip from '@components/StatusChip';
import TestClockForm from '@components/TestClockForm';
import { PAGE_LIMIT } from '@constants/pagination';
import type { TestClockFormData } from '@forms/test-clock-form';
import {
  testClockFormDataToPayload,
  testClockFormDefaultValues,
  testClockFormResolver,
} from '@forms/test-clock-form';
import { Button } from '@heroui/react';
import { useCursorPagination } from '@hooks/useCursorPagination';
import { formatDate } from '@lib/format';
import { useCan } from '@lib/permissions';
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
  const { startingAfter, hasPrevious, advancePage, revertPage } = useCursorPagination();
  const canWrite = useCan(PermissionEnum.TEST_CLOCK_WRITE);

  const {
    data: testClocks,
    isPending,
    error,
  } = useTestClocksQuery({ limit: PAGE_LIMIT, startingAfter }, { hasPlaceholder: true });

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
        <p className="text-app-description text-[13px]">Không có gì để hiển thị.</p>
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

      <div className="border-app-border-soft flex flex-col rounded-md border bg-surface">
        <FilterBar itemCount={size(rows)} />

        <DataTable
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
      </div>

      <EntityDrawer
        isOpen={isCreateOpen}
        title="Tạo test clock"
        description="Đồng hồ đứng ở mốc bạn chọn cho tới khi được tua tới mốc mới."
        onOpenChange={setIsCreateOpen}
      >
        <TestClockForm form={form} isSaving={isSaving} onSave={handleOnSave} />
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
