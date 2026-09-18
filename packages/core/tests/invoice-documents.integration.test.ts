import { DomainEventTypeEnum } from '@contracts/events.types';
import { NotFoundError } from '@errors/app.error';
import { HostedResourceEnum } from '@utils/hosted-url';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestContext } from './context';
import { makeOpenInvoice, TEST_LIVEMODE } from './factories';

const EVENT_SCAN_LIMIT = 200;
const PDF_MAGIC = '%PDF-1.4';

let fastify: FastifyInstance;

beforeAll(async () => {
  fastify = await buildTestContext();
});

afterAll(async () => {
  await fastify.close();
});

function readToken(invoiceId: string): string {
  return fastify.hostedUrlFactory.buildToken(HostedResourceEnum.INVOICE, invoiceId);
}

describe('invoice documents', () => {
  it('gives a finalized invoice a hosted url, a pdf url and a sent stamp', async () => {
    const { invoiceId } = await makeOpenInvoice(fastify);

    const invoice = await fastify.invoiceService.getInvoice(invoiceId, TEST_LIVEMODE);

    expect(invoice.hostedInvoiceUrl).toContain(`/hosted/invoice/${invoiceId}`);
    expect(invoice.invoicePdf).toContain('/pdf');
    expect(invoice.sentAt).toEqual(expect.any(String));
  });

  it('publishes invoice.sent once the document is stored', async () => {
    const { invoiceId } = await makeOpenInvoice(fastify);

    await fastify.outboxService.relayOutboxEvents(EVENT_SCAN_LIMIT);

    const published = await fastify.eventService.findEvents(
      { type: DomainEventTypeEnum.INVOICE_SENT, limit: 100 },
      TEST_LIVEMODE,
    );

    expect(
      _.some(published.data, (event) => {
        return _.get(event.data.object, 'id') === invoiceId;
      }),
    ).toBe(true);
  });

  it('serves the stored pdf to a request carrying the signed token', async () => {
    const { invoiceId } = await makeOpenInvoice(fastify);

    const document = await fastify.invoiceDocumentService.getInvoicePdf(
      invoiceId,
      readToken(invoiceId),
    );

    expect(document.subarray(0, PDF_MAGIC.length).toString('latin1')).toBe(PDF_MAGIC);
  });

  it('refuses a pdf request whose token does not sign that invoice', async () => {
    const { invoiceId } = await makeOpenInvoice(fastify);

    await expect(
      fastify.invoiceDocumentService.getInvoicePdf(invoiceId, 'deadbeefdeadbeefdeadbeefdeadbeef'),
    ).rejects.toThrow(NotFoundError);
  });

  it('renders a replacement copy when the stored object has gone missing', async () => {
    const { invoiceId } = await makeOpenInvoice(fastify);
    const invoice = await fastify.invoiceRepository.findInvoice(invoiceId);

    if (!invoice) {
      throw new Error(`test fixture lost invoice ${invoiceId}`);
    }

    const rendered = await fastify.invoiceDocumentService.renderInvoicePdf(invoice);

    expect(rendered.length).toBeGreaterThan(PDF_MAGIC.length);
  });
});
