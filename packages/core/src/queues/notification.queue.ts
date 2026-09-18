import { QueueNameEnum } from '@queues/queue-name';

export const NOTIFICATION_QUEUE = QueueNameEnum.NOTIFICATION;
export const NOTIFICATION_SEND_JOB = 'NotificationSend';

export enum NotificationKindEnum {
  INVOICE_FINALIZED = 'invoice_finalized',
  INVOICE_SENT = 'invoice_sent',
  PAYMENT_SUCCEEDED = 'payment_succeeded',
  PAYMENT_FAILED = 'payment_failed',
  PAYMENT_ABANDONED = 'payment_abandoned',
  PAYMENT_METHOD_SAVED = 'payment_method_saved',
  PORTAL_MAGIC_LINK = 'portal_magic_link',
}
export type NotificationKind = `${NotificationKindEnum}`;

export interface NotificationSendJob {
  kind: NotificationKind;
  customerId: string;
  invoiceId: string | null;
  paymentIntentId: string | null;
  url: string | null;
  dedupeKey: string;
}

export interface NotificationReferences {
  invoiceId?: string | null;
  paymentIntentId?: string | null;
  url?: string | null;
  dedupeKey?: string;
}

export function buildNotificationSendJob(
  kind: NotificationKind,
  customerId: string,
  references: NotificationReferences = {},
): NotificationSendJob {
  const invoiceId = references.invoiceId ?? null;
  const paymentIntentId = references.paymentIntentId ?? null;

  return {
    kind,
    customerId,
    invoiceId,
    paymentIntentId,
    url: references.url ?? null,
    dedupeKey: references.dedupeKey ?? invoiceId ?? paymentIntentId ?? customerId,
  };
}
