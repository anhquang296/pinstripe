import { InvoiceReminderKindEnum } from '@contracts/invoices.types';
import { CollectionMethodEnum } from '@contracts/subscriptions.types';
import { NotificationKindEnum } from '@queues/notification.queue';
import { InvoiceReminderService } from '@services/invoice-reminder.service';
import { CurrencyEnum } from '@utils/currency';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';

import { buildTestContext } from './context';

const BILLING_OPS_EMAIL = 'ketoan@vexere.test';

let fastify: FastifyInstance;

beforeAll(async () => {
  fastify = await buildTestContext();
});

afterAll(async () => {
  await fastify.close();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function setup() {
  const dispatchSpy = vi
    .spyOn(fastify.notificationService, 'dispatchInvoiceReminder')
    .mockResolvedValue(undefined);

  const invoiceReminderService = new InvoiceReminderService(fastify, {
    billingOpsEmail: BILLING_OPS_EMAIL,
    portalBaseUrl: 'https://portal.test',
  });

  return { dispatchSpy, invoiceReminderService };
}

async function makeOpenInvoice(
  collectionMethod: CollectionMethodEnum,
  daysUntilDue: number,
): Promise<string> {
  const customer = await fastify.customerService.createCustomer({
    email: `${generateGid(ObjectPrefixEnum.CUSTOMER)}@reminder.test`,
    currency: CurrencyEnum.VND,
    name: 'Nhà xe nhắc nợ',
  });

  const draftInvoice = await fastify.invoiceService.createInvoice({
    customerId: customer.id,
    collectionMethod,
    daysUntilDue,
  });

  const openInvoice = await fastify.invoiceService.finalizeInvoice(draftInvoice.id);

  return openInvoice.id;
}

async function moveDueDate(invoiceId: string, days: number): Promise<void> {
  await fastify.database.master.execute(
    `update invoices set due_at = now() + interval '${days} days' where id = '${invoiceId}'`,
  );
}

function readDispatchedKinds(
  dispatchSpy: ReturnType<typeof setup>['dispatchSpy'],
  invoiceId: string,
) {
  return _(dispatchSpy.mock.calls)
    .filter((call) => {
      return call[0].id === invoiceId;
    })
    .map(1)
    .value();
}

it('reminds a bank-transfer invoice due in two days exactly once', async () => {
  const { dispatchSpy, invoiceReminderService } = setup();

  const invoiceId = await makeOpenInvoice(CollectionMethodEnum.SEND_INVOICE, 2);

  await invoiceReminderService.dispatchInvoiceReminders();
  await invoiceReminderService.dispatchInvoiceReminders();

  expect(readDispatchedKinds(dispatchSpy, invoiceId)).toEqual([
    NotificationKindEnum.INVOICE_DUE_SOON,
  ]);
});

it('does not remind an invoice due later than three days from now', async () => {
  const { dispatchSpy, invoiceReminderService } = setup();

  const invoiceId = await makeOpenInvoice(CollectionMethodEnum.SEND_INVOICE, 10);

  await invoiceReminderService.dispatchInvoiceReminders();

  expect(readDispatchedKinds(dispatchSpy, invoiceId)).toEqual([]);
});

it('leaves an automatically charged invoice to dunning', async () => {
  const { dispatchSpy, invoiceReminderService } = setup();

  const invoiceId = await makeOpenInvoice(CollectionMethodEnum.CHARGE_AUTOMATICALLY, 2);

  await invoiceReminderService.dispatchInvoiceReminders();

  expect(readDispatchedKinds(dispatchSpy, invoiceId)).toEqual([]);
});

it('tells the customer one day after the due date and the billing team after five', async () => {
  const { dispatchSpy, invoiceReminderService } = setup();

  const invoiceId = await makeOpenInvoice(CollectionMethodEnum.SEND_INVOICE, 7);

  await moveDueDate(invoiceId, -2);
  await invoiceReminderService.dispatchInvoiceReminders();
  await moveDueDate(invoiceId, -6);
  await invoiceReminderService.dispatchInvoiceReminders();

  const internalCall = _.find(dispatchSpy.mock.calls, (call) => {
    return call[0].id === invoiceId && call[1] === NotificationKindEnum.INVOICE_OVERDUE_INTERNAL;
  });

  expect(readDispatchedKinds(dispatchSpy, invoiceId)).toEqual([
    NotificationKindEnum.INVOICE_OVERDUE,
    NotificationKindEnum.INVOICE_OVERDUE_INTERNAL,
  ]);
  expect(_.get(internalCall, [2, 'recipient'])).toBe(BILLING_OPS_EMAIL);
});

it('records which reminders an invoice has received', async () => {
  const { invoiceReminderService } = setup();

  const invoiceId = await makeOpenInvoice(CollectionMethodEnum.SEND_INVOICE, 2);

  await invoiceReminderService.dispatchInvoiceReminders();

  const invoiceReminders = await fastify.invoiceRepository.findInvoiceReminders(
    [invoiceId],
    InvoiceReminderKindEnum.DUE_SOON,
  );

  expect(invoiceReminders).toHaveLength(1);
});

it('never reminds the billing team when no billing inbox is configured', async () => {
  const dispatchSpy = vi
    .spyOn(fastify.notificationService, 'dispatchInvoiceReminder')
    .mockResolvedValue(undefined);

  const invoiceReminderService = new InvoiceReminderService(fastify, {
    billingOpsEmail: null,
    portalBaseUrl: 'https://portal.test',
  });

  const invoiceId = await makeOpenInvoice(CollectionMethodEnum.SEND_INVOICE, 7);

  await moveDueDate(invoiceId, -6);
  await invoiceReminderService.dispatchInvoiceReminders();

  expect(readDispatchedKinds(dispatchSpy, invoiceId)).toEqual([
    NotificationKindEnum.INVOICE_OVERDUE,
  ]);
});
