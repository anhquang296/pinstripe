'use client';

import PageCard from '@common/components/PageCard';
import SubscriptionCard from '@features/portal/components/SubscriptionCard';
import { Card, Spinner } from '@heroui/react';
import { usePortalSubscriptionsQuery } from '@pinstripe/sdk/react/portal';
import { get, isEmpty, map } from 'lodash-es';

export default function SubscriptionsPage() {
  const { data: subscriptions, isPending } = usePortalSubscriptionsQuery({ limit: 50 });
  const subscriptionRows = get(subscriptions, 'data', []);

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
    </PageCard>
  );
}
