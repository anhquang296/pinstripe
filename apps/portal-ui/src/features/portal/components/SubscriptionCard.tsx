import DetailList from '@common/components/DetailList';
import StatusChip from '@common/components/StatusChip';
import { formatCurrency, formatDate } from '@common/utils/format';
import {
  COLLECTION_METHOD_LABELS,
  RECURRING_INTERVAL_LABELS,
  SUBSCRIPTION_STATUS_LABELS,
} from '@features/portal/constants/labels';
import { Card } from '@heroui/react';
import { UsageTypeEnum } from '@pinstripe/core/contracts';
import type { PortalSubscriptionResponse } from '@pinstripe/sdk';
import { map } from 'lodash-es';

interface SubscriptionCardProps {
  subscription: PortalSubscriptionResponse;
}

type SubscriptionItem = PortalSubscriptionResponse['items'][number];

function buildItemPriceLabel(subscriptionItem: SubscriptionItem, currency: string): string {
  const { unitAmount, interval, intervalCount, usageType } = subscriptionItem;

  if (usageType === UsageTypeEnum.METERED) {
    return 'Tính theo mức sử dụng';
  }

  if (unitAmount === null) {
    return 'Theo bảng giá bậc thang';
  }

  const amountLabel = formatCurrency(unitAmount * subscriptionItem.quantity, currency);

  if (interval) {
    const intervalLabel = RECURRING_INTERVAL_LABELS[interval];
    const countLabel = intervalCount && intervalCount > 1 ? `${intervalCount} ` : '';

    return `${amountLabel} / ${countLabel}${intervalLabel}`;
  }

  return amountLabel;
}

export default function SubscriptionCard({ subscription }: SubscriptionCardProps) {
  const { label, tone } = SUBSCRIPTION_STATUS_LABELS[subscription.status];

  const { cancelAt, trialEnd } = subscription;

  const periodLabel = `${formatDate(subscription.currentPeriodStart)} – ${formatDate(subscription.currentPeriodEnd)}`;

  const details = [
    { label: 'Kỳ hiện tại', value: periodLabel },
    { label: 'Kỳ thu tiếp theo', value: formatDate(subscription.currentPeriodEnd) },
    {
      label: 'Hình thức thanh toán',
      value: COLLECTION_METHOD_LABELS[subscription.collectionMethod],
    },
  ];

  if (trialEnd) {
    details.push({ label: 'Hết dùng thử', value: formatDate(trialEnd) });
  }

  if (subscription.cancelAtPeriodEnd || cancelAt) {
    const cancelLabel = cancelAt ? formatDate(cancelAt) : formatDate(subscription.currentPeriodEnd);

    details.push({ label: 'Ngừng sử dụng từ', value: cancelLabel });
  }

  return (
    <Card>
      <Card.Header className="flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          {map(subscription.items, (subscriptionItem) => {
            return (
              <div key={subscriptionItem.id} className="flex flex-col">
                <Card.Title>
                  {subscriptionItem.productName || subscriptionItem.priceNickname}
                </Card.Title>
                <Card.Description>
                  {buildItemPriceLabel(subscriptionItem, subscription.currency)}
                </Card.Description>
              </div>
            );
          })}
        </div>
        <StatusChip label={label} tone={tone} />
      </Card.Header>
      <Card.Content>
        <DetailList items={details} />
      </Card.Content>
    </Card>
  );
}
