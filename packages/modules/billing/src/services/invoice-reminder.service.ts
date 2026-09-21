import type { InvoiceReminderKind } from '@contracts/invoices.types';
import { InvoiceReminderKindEnum, InvoiceStatusEnum } from '@contracts/invoices.types';
import { CollectionMethodEnum } from '@contracts/subscriptions.types';
import type { NotificationKind } from '@queues/notification.queue';
import { NotificationKindEnum } from '@queues/notification.queue';
import { MILLISECONDS_PER_DAY } from '@vxrerp/platform/constants';
import { generateGid, ObjectPrefixEnum } from '@vxrerp/platform/utils';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

const DUE_SOON_DAYS = 3;
const OVERDUE_DAYS = 1;
const OVERDUE_INTERNAL_DAYS = 5;
const OVERDUE_LOOKBACK_DAYS = 30;

export interface InvoiceReminderConfig {
  billingOpsEmail: string | null;
  portalBaseUrl: string;
}

export type InvoiceReminderRunResult = Partial<Record<InvoiceReminderKind, number>>;

interface InvoiceReminderRule {
  kind: InvoiceReminderKind;
  notificationKind: NotificationKind;
  dueAfterAt: Date;
  dueBeforeAt: Date;
  recipient: string | null;
}

export class InvoiceReminderService {
  constructor(
    private readonly fastify: FastifyInstance,
    private readonly invoiceReminderConfig: InvoiceReminderConfig,
  ) {}

  async dispatchInvoiceReminders(): Promise<InvoiceReminderRunResult> {
    const now = this.fastify.clock.now();
    const invoiceReminderRunResult: InvoiceReminderRunResult = {};

    for (const invoiceReminderRule of this.buildReminderRules(now)) {
      invoiceReminderRunResult[invoiceReminderRule.kind] = await this.dispatchReminderRule(
        invoiceReminderRule,
        now,
      );
    }

    this.fastify.log.info(
      { invoiceReminderRunResult },
      '[InvoiceReminderService] dispatchInvoiceReminders() completed',
    );

    return invoiceReminderRunResult;
  }

  private buildReminderRules(now: Date): InvoiceReminderRule[] {
    const { billingOpsEmail } = this.invoiceReminderConfig;

    const shiftDays = (days: number) => {
      return new Date(now.getTime() + days * MILLISECONDS_PER_DAY);
    };

    const customerRules: InvoiceReminderRule[] = [
      {
        kind: InvoiceReminderKindEnum.DUE_SOON,
        notificationKind: NotificationKindEnum.INVOICE_DUE_SOON,
        dueAfterAt: now,
        dueBeforeAt: shiftDays(DUE_SOON_DAYS),
        recipient: null,
      },
      {
        kind: InvoiceReminderKindEnum.OVERDUE,
        notificationKind: NotificationKindEnum.INVOICE_OVERDUE,
        dueAfterAt: shiftDays(-OVERDUE_LOOKBACK_DAYS),
        dueBeforeAt: shiftDays(-OVERDUE_DAYS),
        recipient: null,
      },
    ];

    if (billingOpsEmail) {
      return [
        ...customerRules,
        {
          kind: InvoiceReminderKindEnum.OVERDUE_INTERNAL,
          notificationKind: NotificationKindEnum.INVOICE_OVERDUE_INTERNAL,
          dueAfterAt: shiftDays(-OVERDUE_LOOKBACK_DAYS),
          dueBeforeAt: shiftDays(-OVERDUE_INTERNAL_DAYS),
          recipient: billingOpsEmail,
        },
      ];
    }

    return customerRules;
  }

  private async dispatchReminderRule(
    invoiceReminderRule: InvoiceReminderRule,
    now: Date,
  ): Promise<number> {
    const REMINDER_BATCH_SIZE = 500;

    const { portalBaseUrl } = this.invoiceReminderConfig;

    const dueInvoices = await this.fastify.invoiceRepository.findInvoices(
      {
        status: InvoiceStatusEnum.OPEN,
        collectionMethod: CollectionMethodEnum.SEND_INVOICE,
        dueAfterAt: invoiceReminderRule.dueAfterAt.toISOString(),
        dueBeforeAt: invoiceReminderRule.dueBeforeAt.toISOString(),
      },
      REMINDER_BATCH_SIZE,
    );

    const sentReminders = await this.fastify.invoiceRepository.findInvoiceReminders(
      _.map(dueInvoices, 'id'),
      invoiceReminderRule.kind,
    );

    const remindedInvoiceIds = new Set(_.map(sentReminders, 'invoiceId'));

    const pendingInvoices = _.reject(dueInvoices, (invoice) => {
      return remindedInvoiceIds.has(invoice.id);
    });

    let dispatchedCount = 0;

    for (const invoice of pendingInvoices) {
      const sentAt = now.toISOString();

      const invoiceReminder = await this.fastify.invoiceRepository.createInvoiceReminder({
        id: generateGid(ObjectPrefixEnum.INVOICE_REMINDER),
        invoiceId: invoice.id,
        kind: invoiceReminderRule.kind,
        sentAt,
        createdAt: sentAt,
      });

      if (invoiceReminder) {
        await this.fastify.notificationService.dispatchInvoiceReminder(
          invoice,
          invoiceReminderRule.notificationKind,
          {
            url: `${portalBaseUrl}/invoices/${encodeURIComponent(invoice.id)}`,
            recipient: invoiceReminderRule.recipient,
          },
        );
        dispatchedCount += 1;
      }
    }

    return dispatchedCount;
  }
}
