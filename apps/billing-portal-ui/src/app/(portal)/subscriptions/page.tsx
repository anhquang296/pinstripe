'use client';

import PageCard from '@common/components/PageCard';
import type { PortalRequestFormData } from '@common/forms/portal-request-form';
import {
  portalRequestFormDefaultValues,
  portalRequestFormResolver,
} from '@common/forms/portal-request-form';
import PortalRequestForm from '@features/portal/components/PortalRequestForm';
import SubscriptionCard from '@features/portal/components/SubscriptionCard';
import { Card, Spinner } from '@heroui/react';
import { PortalRequestKindEnum } from '@vxrerp/billing/contracts';
import {
  useCreatePortalRequestMutation,
  usePortalSubscriptionsQuery,
} from '@vxrerp/sdk/react/portal';
import { get, isEmpty, map } from 'lodash-es';
import { useForm } from 'react-hook-form';

export default function SubscriptionsPage() {
  const { data: subscriptions, isPending } = usePortalSubscriptionsQuery({ limit: 50 });

  const form = useForm<PortalRequestFormData>({
    resolver: portalRequestFormResolver,
    defaultValues: portalRequestFormDefaultValues,
  });

  const { mutate: createPortalRequest, isPending: isSubmitting } = useCreatePortalRequestMutation({
    successMessage: 'Đã gửi yêu cầu. Kế toán Vexere sẽ liên hệ với nhà xe.',
  });

  const subscriptionRows = get(subscriptions, 'data', []);

  const handleOnSubmit = form.handleSubmit((data) => {
    createPortalRequest(
      { kind: PortalRequestKindEnum.PLAN_CHANGE, message: data.message },
      {
        onSuccess: () => {
          form.reset(portalRequestFormDefaultValues);
        },
      },
    );
  });

  if (isPending) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  return (
    <PageCard
      title="Gói dịch vụ"
      description="Các gói nhà xe đã đăng ký, kỳ hiện tại và cách Vexere thu phí."
    >
      {isEmpty(subscriptionRows) ? (
        <Card>
          <Card.Content>
            <span className="text-sm text-muted">Nhà xe chưa đăng ký gói dịch vụ nào.</span>
          </Card.Content>
        </Card>
      ) : null}
      {map(subscriptionRows, (subscription) => {
        return <SubscriptionCard key={subscription.id} subscription={subscription} />;
      })}

      <Card>
        <Card.Header className="flex flex-col gap-1">
          <Card.Title>Yêu cầu đổi gói</Card.Title>
          <Card.Description>
            Nhà xe không tự đổi gói trên cổng. Gửi yêu cầu để kế toán Vexere xác nhận và cập nhật
            hợp đồng.
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <PortalRequestForm
            form={form}
            placeholder="Ví dụ: nhà xe muốn lên gói Pro từ kỳ tháng sau."
            isSubmitting={isSubmitting}
            onSubmit={handleOnSubmit}
          />
        </Card.Content>
      </Card>
    </PageCard>
  );
}
