import type { Customer, Invoice, PaymentIntent, PortalSession } from '@database/schemas';
import { NotFoundError } from '@errors/app.error';
import type { NotificationKind, NotificationSendJob } from '@queues/notification.queue';
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
  ): Promise<NotificationOutcome> {
    return this.sendNotification(
      buildNotificationSendJob(NotificationKindEnum.PORTAL_MAGIC_LINK, portalSession.customerId, {
        url,
        dedupeKey: portalSession.id,
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

    const customer = await this.getCustomer(job.customerId);
    const { email } = customer;

    if (!email) {
      this.fastify.log.warn(
        { kind: job.kind, customerId: job.customerId },
        '[NotificationService] sendNotification() skipped, the customer has no email address',
      );

      return NotificationOutcomeEnum.SKIPPED_NO_EMAIL;
    }

    const context = await this.buildContext(job, customer);
    const message = buildNotificationEmail(job.kind, context);

    await mailer.sendMail({
      to: email,
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

    return {
      customerName: customer.name,
      invoiceNumber: _.get(invoice, 'number', null),
      amount,
      currency: customer.currency,
      declineCode: _.get(paymentIntent, 'declineCode', null),
      nextAttemptAt,
      url: job.url,
    };
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

  private async getCustomer(id: string): Promise<Customer> {
    const customer = await this.fastify.customerRepository.findCustomer(id);

    if (customer) {
      return customer;
    }

    throw new NotFoundError(`No such customer: ${id}`);
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
