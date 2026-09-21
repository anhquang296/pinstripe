import { QueueNameEnum } from '@queues/queue-name';

export const WEBHOOK_QUEUE = QueueNameEnum.WEBHOOK;
export const WEBHOOK_DELIVERY_JOB = 'WebhookDelivery';

export interface WebhookDeliveryJob {
  deliveryId: string;
}

export function buildWebhookDeliveryJob(deliveryId: string): WebhookDeliveryJob {
  return { deliveryId };
}
