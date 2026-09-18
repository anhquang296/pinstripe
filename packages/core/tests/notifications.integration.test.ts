import { PspTokenEnum } from '@clients/mock-psp.client';
import { MILLISECONDS_PER_DAY } from '@constants/time';
import { buildNotificationSendJob, NotificationKindEnum } from '@queues/notification.queue';
import { NotificationOutcomeEnum } from '@services/notification.service';
import { CurrencyEnum } from '@utils/currency';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestContext } from './context';
import { makeOpenInvoice, TEST_LIVEMODE } from './factories';

const CLOCK_START = new Date(Date.now() - 2 * MILLISECONDS_PER_DAY).toISOString();
const MAILPIT_API_URL = 'http://localhost:58025/api/v1';

interface MailpitMessage {
  ID: string;
  Subject: string;
  To: { Address: string }[];
}

interface MailpitSearch {
  messages: MailpitMessage[];
}

let fastify: FastifyInstance;

beforeAll(async () => {
  fastify = await buildTestContext();
});

afterAll(async () => {
  await fastify.close();
});

async function findDeliveredSubject(email: string): Promise<string | null> {
  const response = await fetch(
    `${MAILPIT_API_URL}/search?query=${encodeURIComponent(`to:${email}`)}`,
  );

  if (!response.ok) {
    throw new Error(`mailpit search failed with ${response.status}`);
  }

  const search = (await response.json()) as MailpitSearch;
  const [message] = search.messages;

  return _.get(message, 'Subject', null);
}

describe('NotificationService.sendNotification', () => {
  it('delivers a payment receipt to the customer mailbox', async () => {
    const { customerId, invoiceId } = await makeOpenInvoice(fastify, { frozenTime: CLOCK_START });
    const customer = await fastify.customerService.getCustomer(customerId, TEST_LIVEMODE);
    const paymentIntent = await fastify.paymentService.createPaymentIntent(
      { invoiceId },
      TEST_LIVEMODE,
    );

    await fastify.paymentService.confirmPaymentIntent(paymentIntent.id, {}, TEST_LIVEMODE);
    await fastify.paymentService.drainProviderEvents();

    const outcome = await fastify.notificationService.sendNotification(
      buildNotificationSendJob(NotificationKindEnum.PAYMENT_SUCCEEDED, TEST_LIVEMODE, customerId, {
        invoiceId,
        paymentIntentId: paymentIntent.id,
      }),
    );

    const { email } = customer;
    const subject = await findDeliveredSubject(String(email));

    expect(outcome).toBe(NotificationOutcomeEnum.SENT);
    expect(subject).toContain('Payment received for invoice');
  });

  it('tells a declined customer which code the bank sent back', async () => {
    const { customerId, invoiceId } = await makeOpenInvoice(fastify, {
      frozenTime: CLOCK_START,
      token: PspTokenEnum.CARD_INSUFFICIENT_FUNDS,
    });
    const customer = await fastify.customerService.getCustomer(customerId, TEST_LIVEMODE);
    const paymentIntent = await fastify.paymentService.createPaymentIntent(
      { invoiceId },
      TEST_LIVEMODE,
    );

    await fastify.paymentService.confirmPaymentIntent(paymentIntent.id, {}, TEST_LIVEMODE);
    await fastify.paymentService.drainProviderEvents();

    const outcome = await fastify.notificationService.sendNotification(
      buildNotificationSendJob(NotificationKindEnum.PAYMENT_FAILED, TEST_LIVEMODE, customerId, {
        invoiceId,
        paymentIntentId: paymentIntent.id,
      }),
    );

    const { email } = customer;
    const subject = await findDeliveredSubject(String(email));

    expect(outcome).toBe(NotificationOutcomeEnum.SENT);
    expect(subject).toContain('was declined');
  });

  it('skips a customer with no email rather than failing the job', async () => {
    const customer = await fastify.customerService.createCustomer(
      { currency: CurrencyEnum.VND, name: 'No Mailbox' },
      TEST_LIVEMODE,
    );

    const outcome = await fastify.notificationService.sendNotification(
      buildNotificationSendJob(NotificationKindEnum.PAYMENT_SUCCEEDED, TEST_LIVEMODE, customer.id),
    );

    expect(outcome).toBe(NotificationOutcomeEnum.SKIPPED_NO_EMAIL);
  });

  it('refuses to notify a customer that does not exist', async () => {
    await expect(
      fastify.notificationService.sendNotification(
        buildNotificationSendJob(
          NotificationKindEnum.PAYMENT_SUCCEEDED,
          TEST_LIVEMODE,
          `${ObjectPrefixEnum.CUSTOMER}_${generateGid(ObjectPrefixEnum.CUSTOMER)}`,
        ),
      ),
    ).rejects.toThrow(/No such customer/);
  });
});

describe('NotificationService.dispatchNotification', () => {
  it('queues one job per invoice so a repeated dispatch does not send twice', async () => {
    const { customerId, invoiceId } = await makeOpenInvoice(fastify, { frozenTime: CLOCK_START });
    const invoice = await fastify.invoiceRepository.findInvoice(invoiceId);

    if (!invoice) {
      throw new Error(`test fixture lost invoice ${invoiceId}`);
    }

    await fastify.notificationService.dispatchInvoiceFinalized(invoice);
    await fastify.notificationService.dispatchInvoiceFinalized(invoice);

    const queue = fastify.queues.resolve('NotificationQueue');
    const queued = await queue.getJobs(['waiting', 'delayed', 'active', 'completed']);
    const matching = _.filter(queued, {
      data: { invoiceId, kind: NotificationKindEnum.INVOICE_FINALIZED },
    });

    expect(customerId).not.toBe('');
    expect(matching).toHaveLength(1);
  });

  it('queues exactly one invoice_sent job when an invoice is finalized', async () => {
    const { invoiceId } = await makeOpenInvoice(fastify, { frozenTime: CLOCK_START });

    const queue = fastify.queues.resolve('NotificationQueue');
    const queued = await queue.getJobs(['waiting', 'delayed', 'active', 'completed']);
    const matching = _.filter(queued, {
      data: { invoiceId, kind: NotificationKindEnum.INVOICE_SENT },
    });

    expect(matching).toHaveLength(1);
  });
});

describe('NotificationService.sendNotification for invoice_sent', () => {
  it('mails the customer the hosted invoice link', async () => {
    const { customerId, invoiceId } = await makeOpenInvoice(fastify, { frozenTime: CLOCK_START });
    const customer = await fastify.customerService.getCustomer(customerId, TEST_LIVEMODE);
    const invoice = await fastify.invoiceService.getInvoice(invoiceId, TEST_LIVEMODE);

    const outcome = await fastify.notificationService.sendNotification(
      buildNotificationSendJob(NotificationKindEnum.INVOICE_SENT, TEST_LIVEMODE, customerId, {
        invoiceId,
        url: invoice.hostedInvoiceUrl,
      }),
    );

    const { email } = customer;
    const subject = await findDeliveredSubject(String(email));

    expect(invoice.hostedInvoiceUrl).not.toBeNull();
    expect(outcome).toBe(NotificationOutcomeEnum.SENT);
    expect(subject).toContain('Your invoice');
  });
});
