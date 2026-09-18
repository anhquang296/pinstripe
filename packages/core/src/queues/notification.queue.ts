import { QueueNameEnum } from '@queues/queue-name';

export const NOTIFICATION_QUEUE = QueueNameEnum.NOTIFICATION;
export const NOTIFICATION_SEND_JOB = 'NotificationSend';

export enum NotificationKindEnum {
  INVOICE_FINALIZED = 'invoice_finalized',
  PAYMENT_SUCCEEDED = 'payment_succeeded',
  PAYMENT_FAILED = 'payment_failed',
  PAYMENT_ABANDONED = 'payment_abandoned',
  PAYMENT_METHOD_SAVED = 'payment_method_saved',
}
export type NotificationKind = `${NotificationKindEnum}`;

export interface NotificationSendJob {
  kind: NotificationKind;
  livemode: boolean;
  customerId: string;
  invoiceId: string | null;
  paymentIntentId: string | null;
}

export function buildNotificationSendJob(
  kind: NotificationKind,
  livemode: boolean,
  customerId: string,
  references: { invoiceId?: string | null; paymentIntentId?: string | null } = {},
): NotificationSendJob {
  return {
    kind,
    livemode,
    customerId,
    invoiceId: references.invoiceId ?? null,
    paymentIntentId: references.paymentIntentId ?? null,
  };
}
