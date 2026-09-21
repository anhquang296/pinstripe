import DataTable from '@common/components/DataTable';
import DrawerSection from '@common/components/DrawerSection';
import EntityCell from '@common/components/EntityCell';
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
import { cursorSearchParams, useCursorPagination } from '@common/hooks/useCursorPagination';
import { useSearchPreservingNavigate } from '@common/hooks/useSearchPreservingNavigate';
import { formatDate } from '@common/utils/format';
import { toQuery } from '@common/utils/search-params';
import TestClockForm from '@features/billing/components/TestClockForm';
import { billingPaths } from '@features/billing/routes/paths';
import { Button } from '@heroui/react';
import { useCan } from '@libs/permissions';
import type { TestClockResponse } from '@vxrerp/billing/contracts';
import { TestClockStatusEnum } from '@vxrerp/billing/contracts';
import { PermissionEnum } from '@vxrerp/platform/contracts';
import { useCreateTestClockMutation, useTestClocksQuery } from '@vxrerp/sdk/react';
import { filter, get, last, size } from 'lodash-es';
import { useQueryStates } from 'nuqs';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { generatePath, useParams } from 'react-router-dom';

import TestClockDrawer from './TestClockDrawer';

export default function TestClocksPage() {
  const { testClockId } = useParams();

  const navigate = useSearchPreservingNavigate();

  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [search, setSearch] = useQueryStates(cursorSearchParams);

  const { hasPrevious, advancePage, revertPage } = useCursorPagination({
    after: search.after,
    onPageChange: (after) => {
      setSearch({ after });
    },
  });

  const canWrite = useCan(PermissionEnum.TEST_CLOCK_WRITE);

  const {
    data: testClocks,
    isPending,
    error,
  } = useTestClocksQuery({ limit: PAGE_LIMIT, ...toQuery(search) }, { hasPlaceholder: true });

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
    navigate(generatePath(billingPaths.TEST_CLOCK, { testClockId: testClock.id }));
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
              return <EntityCell id={testClock.id} name={testClock.name} />;
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
            navigate(billingPaths.TEST_CLOCKS);
          }}
        />
      ) : null}
    </PageCard>
  );
}
