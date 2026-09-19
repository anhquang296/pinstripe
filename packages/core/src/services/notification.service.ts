import { CUSTOMER_ACCOUNTANT_EMAIL_KEY } from '@constants/customer';
import type { Customer, Invoice, PaymentIntent, PortalSession } from '@database/schemas';
import type {
  NotificationKind,
  NotificationReferences,
  NotificationSendJob,
} from '@queues/notification.queue';
import {
  buildNotificationSendJob,
  NOTIFICATION_SEND_JOB,
  NotificationKindEnum,
} from '@queues/notification.queue';
import { QueueNameEnum } from '@queues/queue-name';
import type { NotificationContext } from '@utils/notification-template';
import { buildNotificationEmail } from '@utils/notification-template';
import type { Job } from 'bullmq';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

export enum NotificationOutcomeEnum {
  SENT = 'sent',
  SKIPPED_NO_MAILER = 'skipped_no_mailer',
  SKIPPED_NO_EMAIL = 'skipped_no_email',
}
export type NotificationOutcome = `${NotificationOutcomeEnum}`;

const REMINDER_NOTIFICATION_KINDS: readonly NotificationKind[] = [
  NotificationKindEnum.INVOICE_DUE_SOON,
  NotificationKindEnum.INVOICE_OVERDUE,
  NotificationKindEnum.INVOICE_OVERDUE_INTERNAL,
];

export class NotificationService {
  constructor(private readonly fastify: FastifyInstance) {}

  async dispatchNotification(job: NotificationSendJob): Promise<Job<NotificationSendJob>> {
    return this.fastify.queues.resolve(QueueNameEnum.NOTIFICATION).add(NOTIFICATION_SEND_JOB, job, {
      jobId: `notification:${job.kind}:${job.dedupeKey}`,
    });
  }

  async dispatchInvoiceSent(invoice: Invoice, url: string): Promise<void> {
    await this.dispatchNotification(
      buildNotificationSendJob(NotificationKindEnum.INVOICE_SENT, invoice.customerId, {
        invoiceId: invoice.id,
        url,
      }),
    );
  }

  async dispatchPortalMagicLink(
    portalSession: PortalSession,
    url: string,
    references: Pick<NotificationReferences, 'recipient'>,
  ): Promise<NotificationOutcome> {
    return this.sendNotification(
      buildNotificationSendJob(NotificationKindEnum.PORTAL_MAGIC_LINK, portalSession.customerId, {
        ...references,
        url,
        dedupeKey: portalSession.id,
      }),
    );
  }

  async dispatchInvoiceReminder(
    invoice: Invoice,
    kind: NotificationKind,
    references: Pick<NotificationReferences, 'url' | 'recipient'>,
  ): Promise<void> {
    await this.dispatchNotification(
      buildNotificationSendJob(kind, invoice.customerId, {
        ...references,
        invoiceId: invoice.id,
      }),
    );
  }

  async dispatchInvoiceFinalized(invoice: Invoice): Promise<void> {
    await this.dispatchNotification(
      buildNotificationSendJob(NotificationKindEnum.INVOICE_FINALIZED, invoice.customerId, {
        invoiceId: invoice.id,
      }),
    );
  }

  async dispatchPaymentSucceeded(paymentIntent: PaymentIntent): Promise<void> {
    await this.dispatchNotification(
      buildNotificationSendJob(NotificationKindEnum.PAYMENT_SUCCEEDED, paymentIntent.customerId, {
        invoiceId: paymentIntent.invoiceId,
        paymentIntentId: paymentIntent.id,
      }),
    );
  }

  async dispatchPaymentFailed(paymentIntent: PaymentIntent): Promise<void> {
    await this.dispatchNotification(
      buildNotificationSendJob(NotificationKindEnum.PAYMENT_FAILED, paymentIntent.customerId, {
        invoiceId: paymentIntent.invoiceId,
        paymentIntentId: paymentIntent.id,
      }),
    );
  }

  async dispatchPaymentAbandoned(invoice: Invoice): Promise<void> {
    await this.dispatchNotification(
      buildNotificationSendJob(NotificationKindEnum.PAYMENT_ABANDONED, invoice.customerId, {
        invoiceId: invoice.id,
      }),
    );
  }

  async sendNotification(job: NotificationSendJob): Promise<NotificationOutcome> {
    const { mailer } = this.fastify;

    if (!mailer) {
      this.fastify.log.warn(
        { kind: job.kind, customerId: job.customerId },
        '[NotificationService] sendNotification() skipped, outbound mail is not configured',
      );

      return NotificationOutcomeEnum.SKIPPED_NO_MAILER;
    }

    const customer = await this.fastify.customerRepository.getCustomer(job.customerId);
    const recipient = job.recipient || customer.email;

    if (!recipient) {
      this.fastify.log.warn(
        { kind: job.kind, customerId: job.customerId },
        '[NotificationService] sendNotification() skipped, the customer has no email address',
      );

      return NotificationOutcomeEnum.SKIPPED_NO_EMAIL;
    }

    const context = await this.buildContext(job, customer);
    const message = buildNotificationEmail(job.kind, context);

    await mailer.sendMail({
      to: recipient,
      cc: NotificationService.resolveCarbonCopies(job.kind, customer),
      subject: message.subject,
      text: message.text,
      html: message.html,
    });

    this.fastify.log.info(
      { kind: job.kind, customerId: customer.id },
      '[NotificationService] sendNotification() success',
    );

    return NotificationOutcomeEnum.SENT;
  }

  private async buildContext(
    job: NotificationSendJob,
    customer: Customer,
  ): Promise<NotificationContext> {
    const invoice = await this.resolveInvoice(job.invoiceId);
    const paymentIntent = await this.resolvePaymentIntent(job.paymentIntentId);
    const amount = NotificationService.resolveAmount(job.kind, invoice, paymentIntent);
    const nextAttemptAt = NotificationService.resolveNextAttemptAt(invoice);
    const invoiceNumber = _.get(invoice, 'number', null);
    const declineCode = _.get(paymentIntent, 'declineCode', null);
    const dueAt = _.get(invoice, 'dueAt', null);

    return {
      customerName: customer.name,
      invoiceNumber,
      amount,
      currency: customer.currency,
      declineCode,
      nextAttemptAt,
      dueAt: dueAt ? new Date(dueAt) : null,
      url: job.url,
    };
  }

  private static resolveCarbonCopies(kind: NotificationKind, customer: Customer): string[] {
    const accountantEmail = _.get(customer.metadata, CUSTOMER_ACCOUNTANT_EMAIL_KEY);

    if (_.includes(REMINDER_NOTIFICATION_KINDS, kind) && accountantEmail) {
      return [accountantEmail];
    }

    return [];
  }

  private async resolveInvoice(invoiceId: string | null): Promise<Invoice | null> {
    if (invoiceId) {
      return this.fastify.invoiceRepository.findInvoice(invoiceId);
    }

    return null;
  }

  private async resolvePaymentIntent(
    paymentIntentId: string | null,
  ): Promise<PaymentIntent | null> {
    if (paymentIntentId) {
      return this.fastify.paymentIntentRepository.findPaymentIntent(paymentIntentId);
    }

    return null;
  }

  private static resolveAmount(
    kind: NotificationKind,
    invoice: Invoice | null,
    paymentIntent: PaymentIntent | null,
  ): number {
    if (kind === NotificationKindEnum.PAYMENT_SUCCEEDED && paymentIntent) {
      return paymentIntent.amountReceived;
    }

    if (paymentIntent) {
      return paymentIntent.amount;
    }

    if (invoice && _.includes(REMINDER_NOTIFICATION_KINDS, kind)) {
      return invoice.amountDue - invoice.amountPaid;
    }

    return _.get(invoice, 'amountDue', 0);
  }

  private static resolveNextAttemptAt(invoice: Invoice | null): Date | null {
    const nextAttemptAt = _.get(invoice, 'nextAttemptAt', null);

    if (nextAttemptAt) {
      return new Date(nextAttemptAt);
    }

    return null;
  }
}
