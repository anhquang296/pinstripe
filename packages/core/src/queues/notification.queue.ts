import { QueueNameEnum } from '@queues/queue-name';

export const NOTIFICATION_QUEUE = QueueNameEnum.NOTIFICATION;
export const NOTIFICATION_SEND_JOB = 'NotificationSend';
export const INVOICE_REMINDER_RUN_JOB = 'InvoiceReminderRun';

export enum NotificationKindEnum {
  INVOICE_FINALIZED = 'invoice_finalized',
  INVOICE_SENT = 'invoice_sent',
  INVOICE_DUE_SOON = 'invoice_due_soon',
  INVOICE_OVERDUE = 'invoice_overdue',
  INVOICE_OVERDUE_INTERNAL = 'invoice_overdue_internal',
  PORTAL_PLAN_CHANGE_REQUEST = 'portal_plan_change_request',
  PORTAL_PROFILE_UPDATE_REQUEST = 'portal_profile_update_request',
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
  recipient: string | null;
  message: string | null;
  dedupeKey: string;
}

export type InvoiceReminderRunJob = Record<string, never>;

export interface NotificationReferences {
  invoiceId?: string | null;
  paymentIntentId?: string | null;
  url?: string | null;
  recipient?: string | null;
  message?: string | null;
  dedupeKey?: string;
}

export function buildNotificationSendJob(
  kind: NotificationKind,
  customerId: string,
  references: NotificationReferences = {},
): NotificationSendJob {
  const {
    invoiceId = null,
    paymentIntentId = null,
    url = null,
    recipient = null,
    message = null,
    dedupeKey = invoiceId ?? paymentIntentId ?? customerId,
  } = references;

  return {
    kind,
    customerId,
    invoiceId,
    paymentIntentId,
    url,
    recipient,
    message,
    dedupeKey,
  };
}
