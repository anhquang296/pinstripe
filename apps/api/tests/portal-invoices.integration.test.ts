import type { InvoiceResponse } from '@pinstripe/core/contracts';
import {
  CollectionMethodEnum,
  CurrencyEnum,
  RecurringIntervalEnum,
} from '@pinstripe/core/contracts';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';
import { afterAll, beforeAll, expect, it } from 'vitest';

import { buildAuthHeaders, buildTestApp } from './context';

let fastify: FastifyInstance;

beforeAll(async () => {
  fastify = await buildTestApp();
});

afterAll(async () => {
  await fastify.close();
});

async function makePortalCustomer(): Promise<{
  customerId: string;
  headers: Record<string, string>;
}> {
  const email = `${_.uniqueId('portal-invoices-')}-${Date.now()}@portal.test`;
  const customer = await fastify.customerService.createCustomer({
    email,
    currency: CurrencyEnum.VND,
    name: 'Nhà xe Portal Test',
  });
  const link = await fastify.portalSessionService.createPortalLink({ email });
  const portalSession = await fastify.portalSessionService.redeemPortalLink({
    linkKey: String(link.linkKey),
  });

  return { customerId: customer.id, headers: buildAuthHeaders(String(portalSession.sessionKey)) };
}

async function makeOpenInvoice(customerId: string): Promise<InvoiceResponse> {
  const draftInvoice = await fastify.invoiceService.createInvoice({
    customerId,
    collectionMethod: CollectionMethodEnum.SEND_INVOICE,
    daysUntilDue: 7,
  });

  return fastify.invoiceService.finalizeInvoice(draftInvoice.id);
}

async function moveDueDateIntoThePast(invoiceId: string): Promise<void> {
  await fastify.database.master.execute(
    `update invoices set due_at = now() - interval '3 days' where id = '${invoiceId}'`,
  );
}

it('splits open invoices into overdue and not yet due', async () => {
  const { customerId, headers } = await makePortalCustomer();
  const overdueInvoice = await makeOpenInvoice(customerId);
  const upcomingInvoice = await makeOpenInvoice(customerId);

  await moveDueDateIntoThePast(overdueInvoice.id);

  const overdue = await fastify.inject({
    method: 'GET',
    url: '/portal/invoices?isOverdue=true',
    headers,
  });
  const upcoming = await fastify.inject({
    method: 'GET',
    url: '/portal/invoices?isOverdue=false',
    headers,
  });

  expect(_.map(overdue.json().data, 'id')).toEqual([overdueInvoice.id]);
  expect(_.map(upcoming.json().data, 'id')).toEqual([upcomingInvoice.id]);
});

it('reads one of the customer own invoices together with its due date', async () => {
  const { customerId, headers } = await makePortalCustomer();
  const openInvoice = await makeOpenInvoice(customerId);

  const response = await fastify.inject({
    method: 'GET',
    url: `/portal/invoices/${openInvoice.id}`,
    headers,
  });

  expect(response.statusCode).toBe(200);
  expect(response.json().id).toBe(openInvoice.id);
  expect(response.json().dueAt).toEqual(expect.any(String));
});

it('answers 404 for an invoice that belongs to another customer', async () => {
  const { headers } = await makePortalCustomer();
  const other = await makePortalCustomer();
  const otherInvoice = await makeOpenInvoice(other.customerId);

  const invoice = await fastify.inject({
    method: 'GET',
    url: `/portal/invoices/${otherInvoice.id}`,
    headers,
  });
  const pdf = await fastify.inject({
    method: 'GET',
    url: `/portal/invoices/${otherInvoice.id}/pdf`,
    headers,
  });

  expect(invoice.statusCode).toBe(404);
  expect(pdf.statusCode).toBe(404);
});

it('answers 404 for a draft invoice of the customer', async () => {
  const { customerId, headers } = await makePortalCustomer();
  const draftInvoice = await fastify.invoiceService.createInvoice({
    customerId,
    collectionMethod: CollectionMethodEnum.SEND_INVOICE,
    daysUntilDue: 7,
  });

  const response = await fastify.inject({
    method: 'GET',
    url: `/portal/invoices/${draftInvoice.id}`,
    headers,
  });

  expect(response.statusCode).toBe(404);
});

it('serves the pdf of the customer own invoice', async () => {
  const { customerId, headers } = await makePortalCustomer();
  const openInvoice = await makeOpenInvoice(customerId);

  const response = await fastify.inject({
    method: 'GET',
    url: `/portal/invoices/${openInvoice.id}/pdf`,
    headers,
  });

  expect(response.statusCode).toBe(200);
  expect(response.headers['content-type']).toContain('application/pdf');
  expect(response.rawPayload.subarray(0, 5).toString('latin1')).toBe('%PDF-');
});

it('totals the open invoices of the customer and names the next due date', async () => {
  const { customerId, headers } = await makePortalCustomer();
  const overdueInvoice = await makeOpenInvoice(customerId);
  const upcomingInvoice = await makeOpenInvoice(customerId);

  await moveDueDateIntoThePast(overdueInvoice.id);

  const response = await fastify.inject({ method: 'GET', url: '/portal/invoice_totals', headers });
  const [totals] = response.json().totals;

  expect(response.statusCode).toBe(200);
  expect(totals).toMatchObject({
    currency: CurrencyEnum.VND,
    openCount: 2,
    overdueCount: 1,
    nextDueAt: upcomingInvoice.dueAt,
  });
});

it('lists the customer subscriptions with the product name of every item', async () => {
  const { customerId, headers } = await makePortalCustomer();
  const product = await fastify.productService.createProduct({ name: 'Phần mềm BMS' });
  const price = await fastify.priceService.createPrice({
    productId: product.id,
    currency: CurrencyEnum.VND,
    unitAmount: 5_000_000,
    recurring: { interval: RecurringIntervalEnum.MONTH },
  });

  await fastify.subscriptionService.createSubscription({
    customerId,
    collectionMethod: CollectionMethodEnum.SEND_INVOICE,
    items: [{ priceId: price.id }],
  });

  const response = await fastify.inject({ method: 'GET', url: '/portal/subscriptions', headers });
  const [subscription] = response.json().data;

  expect(response.statusCode).toBe(200);
  expect(subscription.items).toEqual([
    expect.objectContaining({
      productName: 'Phần mềm BMS',
      unitAmount: 5_000_000,
      interval: RecurringIntervalEnum.MONTH,
    }),
  ]);
  expect(subscription).not.toHaveProperty('defaultPaymentMethodId');
});
