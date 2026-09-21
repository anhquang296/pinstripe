'use client';

import PageCard from '@common/components/PageCard';
import UsageTable from '@features/portal/components/UsageTable';
import { Alert } from '@heroui/react';
import { usePortalUsageQuery } from '@vxrerp/sdk/react/portal';
import { get } from 'lodash-es';

export default function UsagePage() {
  const { data: usage, isPending } = usePortalUsageQuery();

  return (
    <PageCard
      title="Mức sử dụng"
      description="Số lượng đã dùng trong kỳ hiện tại của các dịch vụ tính theo thực dùng."
    >
      <Alert status="accent">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Số liệu cập nhật theo kỳ của từng gói</Alert.Title>
          <Alert.Description>
            Phần vượt hạn mức trong gói sẽ được tính vào hóa đơn của kỳ khi Vexere phát hành.
          </Alert.Description>
        </Alert.Content>
      </Alert>

      <UsageTable items={get(usage, 'items', [])} isLoading={isPending} />
    </PageCard>
  );
}
