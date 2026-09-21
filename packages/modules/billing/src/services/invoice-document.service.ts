import { INVOICE_STATUS_LABELS } from '@constants/invoice-labels';
import type { Customer, Invoice, InvoiceLineItem } from '@database/schemas';
import type { Currency } from '@utils/currency';
import { HostedResourceEnum } from '@utils/hosted-url';
import { Money } from '@utils/money';
import type { PdfLine } from '@utils/pdf-document';
import { renderPdfDocument } from '@utils/pdf-document';
import { AggregateTypeEnum, DomainEventTypeEnum } from '@vxrerp/platform/contracts';
import { NotFoundError } from '@vxrerp/platform/errors';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

const DOCUMENT_LOCALE = 'vi-VN';
const DOCUMENT_TIME_ZONE = 'Asia/Ho_Chi_Minh';

function formatDocumentMoney(minorAmount: number, currency: Currency): string {
  return new Intl.NumberFormat(DOCUMENT_LOCALE, {
    style: 'currency',
    currency: _.toUpper(currency),
  }).format(Money.of(minorAmount, currency).toMajorUnit());
}

function formatDocumentDate(isoDate: string): string {
  return new Intl.DateTimeFormat(DOCUMENT_LOCALE, {
    timeZone: DOCUMENT_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(isoDate));
}

function buildOptionalLabel(value: string | null): string {
  if (value) {
    return value;
  }

  return '—';
}

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

    const sentAt = this.fastify.clock.now().toISOString();
    const hostedInvoiceUrl = this.fastify.hostedUrlFactory.buildInvoiceUrl(invoice.id);
    const invoicePdf = this.fastify.hostedUrlFactory.buildInvoicePdfUrl(invoice.id);

    const sentInvoice = await this.fastify.database.master.transaction(async (tx) => {
      const markedInvoice = await this.fastify.invoiceRepository.updateInvoice(
        invoice.id,
        { sentAt, updatedAt: sentAt },
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

    return this.readInvoicePdf(invoice);
  }

  async getCustomerInvoicePdf(customerId: string, id: string): Promise<Buffer> {
    const visibleInvoice = await this.fastify.invoiceService.getCustomerInvoice(customerId, id);
    const invoice = await this.fastify.invoiceRepository.getInvoice(visibleInvoice.id);

    return this.readInvoicePdf(invoice);
  }

  async readInvoicePdf(invoice: Invoice): Promise<Buffer> {
    const storageKey = InvoiceDocumentService.buildStorageKey(invoice);

    try {
      return await this.fastify.fileStorage.getObject(storageKey);
    } catch (error) {
      this.fastify.log.warn(
        { error, invoiceId: invoice.id },
        '[InvoiceDocumentService] readInvoicePdf() rendering a replacement copy',
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
    const customer = await this.fastify.customerRepository.getCustomer(invoice.customerId);
    const lineItems = await this.fastify.invoiceRepository.findInvoiceLineItems([invoice.id]);

    return renderPdfDocument(InvoiceDocumentService.buildPdfLines(invoice, customer, lineItems));
  }

  private static buildStorageKey(invoice: Invoice): string {
    return `invoices/${invoice.id}.pdf`;
  }

  private static buildPdfLines(
    invoice: Invoice,
    customer: Customer,
    lineItems: readonly InvoiceLineItem[],
  ): PdfLine[] {
    const amount = (value: number) => {
      return formatDocumentMoney(value, invoice.currency);
    };

    const periodLabel = `${formatDocumentDate(invoice.periodStart)} – ${formatDocumentDate(invoice.periodEnd)}`;
    const dueLabel = buildOptionalLabel(invoice.dueAt && formatDocumentDate(invoice.dueAt));

    return [
      { text: `Hóa đơn ${buildInvoiceLabel(invoice)}`, isTitle: true },
      { text: '' },
      { text: `Nhà xe: ${buildCustomerLabel(customer)}` },
      { text: `Mã số thuế: ${buildOptionalLabel(customer.taxId)}` },
      { text: `Email thanh toán: ${buildOptionalLabel(customer.email)}` },
      { text: '' },
      { text: `Trạng thái: ${INVOICE_STATUS_LABELS[invoice.status]}` },
      { text: `Kỳ dịch vụ: ${periodLabel}` },
      { text: `Hạn thanh toán: ${dueLabel}` },
      { text: '' },
      { text: 'Dịch vụ', amount: 'Thành tiền', isBold: true },
      ..._.map(lineItems, (lineItem): PdfLine => {
        return {
          text: `${lineItem.description} × ${lineItem.quantity}`,
          amount: amount(lineItem.amount),
        };
      }),
      { text: '' },
      { text: 'Tạm tính', amount: amount(invoice.subtotal) },
      { text: 'Giảm giá', amount: amount(invoice.totalDiscountAmount) },
      { text: 'Thuế', amount: amount(invoice.totalTaxAmount) },
      { text: 'Tổng cộng', amount: amount(invoice.total), isBold: true },
      { text: 'Số tiền phải trả', amount: amount(invoice.amountDue), isBold: true },
    ];
  }
}
