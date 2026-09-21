import type { InvoiceResponse } from '@vxrerp/billing/contracts';
import {
  CollectionMethodEnum,
  CurrencyEnum,
  PortalPaymentChannelEnum,
} from '@vxrerp/billing/contracts';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';
import { afterAll, beforeAll, expect, it } from 'vitest';

import { buildAuthHeaders, buildTestApp } from './context';

const BANK_TRANSFER_ENV = {
  BANK_TRANSFER_BANK_BIN: '970436',
  BANK_TRANSFER_BANK_NAME: 'Vietcombank',
  BANK_TRANSFER_ACCOUNT_NUMBER: '0011001234567',
  BANK_TRANSFER_ACCOUNT_NAME: 'CONG TY CO PHAN VEXERE',
};

let fastify: FastifyInstance;

beforeAll(async () => {
  Object.assign(process.env, BANK_TRANSFER_ENV);
  fastify = await buildTestApp();
});

afterAll(async () => {
  await fastify.close();

  for (const key of _.keys(BANK_TRANSFER_ENV)) {
    delete process.env[key];
  }
});

async function makePortalCustomer(
  metadata: Record<string, string> = {},
): Promise<{ customerId: string; headers: Record<string, string> }> {
  const email = `${_.uniqueId('portal-payments-')}-${Date.now()}@portal.test`;

  const customer = await fastify.customerService.createCustomer({
    email,
    currency: CurrencyEnum.VND,
    name: 'Nhà xe Thanh Toán',
    metadata,
  });

  const link = await fastify.portalSessionService.createPortalLink({ email });

  const portalSession = await fastify.portalSessionService.redeemPortalLink({
    linkKey: String(link.linkKey),
  });

  return { customerId: customer.id, headers: buildAuthHeaders(String(portalSession.sessionKey)) };
}

async function makeOpenInvoice(customerId: string, amount: number): Promise<InvoiceResponse> {
  const draftInvoice = await fastify.invoiceService.createInvoice({
    customerId,
    collectionMethod: CollectionMethodEnum.SEND_INVOICE,
    daysUntilDue: 10,
  });

  await fastify.invoiceItemService.createInvoiceItem({
    customerId,
    invoiceId: draftInvoice.id,
    currency: CurrencyEnum.VND,
    description: 'Phí duy trì phần mềm',
    amount,
  });

  return fastify.invoiceService.finalizeInvoice(draftInvoice.id);
}

it('lists a recorded payment with the number of the invoice it settled', async () => {
  const { customerId, headers } = await makePortalCustomer();

  const openInvoice = await makeOpenInvoice(customerId, 500_000);

  await fastify.invoiceService.payInvoice(openInvoice.id, {});

  const response = await fastify.inject({ method: 'GET', url: '/v1/portal/payments', headers });

  expect(response.statusCode).toBe(200);
  expect(response.json().data).toEqual([
    expect.objectContaining({
      invoiceId: openInvoice.id,
      invoiceNumber: openInvoice.number,
      amount: 500_000,
      channel: PortalPaymentChannelEnum.RECORDED,
    }),
  ]);
});

it('narrows the payment history to one invoice of the customer', async () => {
  const { customerId, headers } = await makePortalCustomer();

  const firstInvoice = await makeOpenInvoice(customerId, 100_000);
  const secondInvoice = await makeOpenInvoice(customerId, 200_000);

  await fastify.invoiceService.payInvoice(firstInvoice.id, {});
  await fastify.invoiceService.payInvoice(secondInvoice.id, {});

  const response = await fastify.inject({
    method: 'GET',
    url: `/v1/portal/payments?invoiceId=${secondInvoice.id}`,
    headers,
  });

  expect(_.map(response.json().data, 'invoiceId')).toEqual([secondInvoice.id]);
});

it('shows no payment of another customer, even when asked by its invoice id', async () => {
  const { headers } = await makePortalCustomer();

  const other = await makePortalCustomer();
  const otherInvoice = await makeOpenInvoice(other.customerId, 100_000);

  await fastify.invoiceService.payInvoice(otherInvoice.id, {});

  const response = await fastify.inject({
    method: 'GET',
    url: `/v1/portal/payments?invoiceId=${otherInvoice.id}`,
    headers,
  });

  expect(response.json().data).toEqual([]);
});

it('gives bank transfer details and a VietQR payload for an open invoice', async () => {
  const { customerId, headers } = await makePortalCustomer();

  const openInvoice = await makeOpenInvoice(customerId, 750_000);

  const response = await fastify.inject({
    method: 'GET',
    url: `/v1/portal/invoices/${openInvoice.id}/bank_transfer`,
    headers,
  });

  const bankTransfer = response.json();

  expect(response.statusCode).toBe(200);
  expect(bankTransfer).toMatchObject({
    bankName: 'Vietcombank',
    accountNumber: '0011001234567',
    amount: 750_000,
    transferContent: String(openInvoice.number).replace('-', ''),
  });
  expect(bankTransfer.qrPayload).toContain('0011001234567');
  expect(bankTransfer.qrPayload).toContain('5406750000');
});

it('offers no bank transfer for an invoice that is already paid', async () => {
  const { customerId, headers } = await makePortalCustomer();

  const openInvoice = await makeOpenInvoice(customerId, 300_000);

  await fastify.invoiceService.payInvoice(openInvoice.id, {});

  const response = await fastify.inject({
    method: 'GET',
    url: `/v1/portal/invoices/${openInvoice.id}/bank_transfer`,
    headers,
  });

  expect(response.statusCode).toBe(404);
});

it('exports the customer invoices as a csv Excel can open', async () => {
  const { customerId, headers } = await makePortalCustomer();

  const openInvoice = await makeOpenInvoice(customerId, 400_000);

  const response = await fastify.inject({
    method: 'GET',
    url: '/v1/portal/invoice_exports',
    headers,
  });

  expect(response.statusCode).toBe(200);
  expect(response.headers['content-type']).toContain('text/csv');
  expect(response.headers['content-disposition']).toContain('attachment');
  expect(response.body.startsWith('﻿')).toBe(true);
  expect(response.body).toContain(`${openInvoice.number},`);
});

it('names the Vexere accountant in charge and the credit balance on /portal/me', async () => {
  const { headers } = await makePortalCustomer({
    accountantName: 'Trần Vân',
    accountantEmail: 'van.tran@vexere.test',
  });

  const response = await fastify.inject({ method: 'GET', url: '/v1/portal/me', headers });

  expect(response.json()).toMatchObject({
    accountantName: 'Trần Vân',
    accountantEmail: 'van.tran@vexere.test',
    balance: 0,
  });
});
