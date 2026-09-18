import { AggregateTypeEnum, DomainEventTypeEnum } from '@contracts/events.types';
import type { Customer, Invoice, InvoiceLineItem } from '@database/schemas';
import { NotFoundError } from '@errors/app.error';
import { HostedResourceEnum } from '@utils/hosted-url';
import { Money } from '@utils/money';
import type { PdfLine } from '@utils/pdf-document';
import { buildPdfDocument } from '@utils/pdf-document';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

function buildInvoiceLabel(invoice: Invoice): string {
  const { number } = invoice;

  if (number) {
    return number;
  }

  return invoice.id;
}

function buildCustomerLabel(customer: Customer): string {
  if (customer.name) {
    return customer.name;
  }

  if (customer.email) {
    return customer.email;
  }

  return customer.id;
}

export class InvoiceDocumentService {
  constructor(private readonly fastify: FastifyInstance) {}

  async issueInvoiceDocument(invoice: Invoice): Promise<Invoice> {
    const storageKey = InvoiceDocumentService.buildStorageKey(invoice);
    const document = await this.renderInvoicePdf(invoice);

    await this.fastify.fileStorage.createObject(storageKey, document);

    const now = this.fastify.clock.now();
    const hostedInvoiceUrl = this.fastify.hostedUrlFactory.buildInvoiceUrl(invoice.id);
    const invoicePdf = this.fastify.hostedUrlFactory.buildInvoicePdfUrl(invoice.id);

    const sentInvoice = await this.fastify.database.master.transaction(async (tx) => {
      const markedInvoice = await this.fastify.invoiceRepository.updateInvoice(
        invoice.id,
        { sentAt: now, updatedAt: now },
        tx,
      );

      if (!markedInvoice) {
        throw new NotFoundError(`No such invoice: ${invoice.id}`);
      }

      await this.fastify.outboxService.recordEvents(
        [
          {
            aggregateType: AggregateTypeEnum.INVOICE,
            aggregateId: markedInvoice.id,
            livemode: markedInvoice.livemode,
            eventType: DomainEventTypeEnum.INVOICE_SENT,
            payload: {
              id: markedInvoice.id,
              number: markedInvoice.number,
              total: markedInvoice.total,
              currency: markedInvoice.currency,
              hostedInvoiceUrl,
              invoicePdf,
            },
          },
        ],
        tx,
      );

      return markedInvoice;
    });

    await this.fastify.notificationService.dispatchInvoiceSent(sentInvoice, hostedInvoiceUrl);

    this.fastify.log.info(
      { invoiceId: sentInvoice.id },
      '[InvoiceDocumentService] issueInvoiceDocument() success',
    );

    return sentInvoice;
  }

  async getInvoicePdf(id: string, token: string): Promise<Buffer> {
    const invoice = await this.getVerifiedInvoice(id, token);
    const storageKey = InvoiceDocumentService.buildStorageKey(invoice);

    try {
      return await this.fastify.fileStorage.getObject(storageKey);
    } catch (error) {
      this.fastify.log.warn(
        { error, invoiceId: invoice.id },
        '[InvoiceDocumentService] getInvoicePdf() rendering a replacement copy',
      );

      const document = await this.renderInvoicePdf(invoice);

      await this.fastify.fileStorage.createObject(storageKey, document);

      return document;
    }
  }

  async getVerifiedInvoice(id: string, token: string): Promise<Invoice> {
    const isVerified = this.fastify.hostedUrlFactory.verifyToken(
      HostedResourceEnum.INVOICE,
      id,
      token,
    );
    const invoice = await this.fastify.invoiceRepository.findInvoice(id);

    if (isVerified && invoice) {
      return invoice;
    }

    throw new NotFoundError(`No such invoice: ${id}`);
  }

  async renderInvoicePdf(invoice: Invoice): Promise<Buffer> {
    const customer = await this.getCustomer(invoice.customerId);
    const lineItems = await this.fastify.invoiceRepository.findInvoiceLineItems([invoice.id]);

    return buildPdfDocument(InvoiceDocumentService.buildPdfLines(invoice, customer, lineItems));
  }

  private async getCustomer(id: string): Promise<Customer> {
    const customer = await this.fastify.customerRepository.findCustomer(id);

    if (customer) {
      return customer;
    }

    throw new NotFoundError(`No such customer: ${id}`);
  }

  private static buildStorageKey(invoice: Invoice): string {
    const mode = invoice.livemode ? 'live' : 'test';

    return `invoices/${mode}/${invoice.id}.pdf`;
  }

  private static buildPdfLines(
    invoice: Invoice,
    customer: Customer,
    lineItems: readonly InvoiceLineItem[],
  ): PdfLine[] {
    const amount = (value: number) => {
      return Money.of(value, invoice.currency).toString();
    };

    return [
      { text: `Invoice ${buildInvoiceLabel(invoice)}`, isTitle: true },
      { text: '' },
      { text: `Billed to: ${buildCustomerLabel(customer)}` },
      { text: `Status: ${invoice.status}` },
      {
        text: `Period: ${invoice.periodStart.toISOString()} to ${invoice.periodEnd.toISOString()}`,
      },
      { text: '' },
      ..._.map(lineItems, (lineItem): PdfLine => {
        return {
          text: `${lineItem.description} x ${lineItem.quantity} = ${amount(lineItem.amount)}`,
        };
      }),
      { text: '' },
      { text: `Subtotal: ${amount(invoice.subtotal)}` },
      { text: `Discounts: ${amount(invoice.totalDiscountAmount)}` },
      { text: `Tax: ${amount(invoice.totalTaxAmount)}` },
      { text: `Total: ${amount(invoice.total)}` },
      { text: `Amount due: ${amount(invoice.amountDue)}` },
    ];
  }
}
