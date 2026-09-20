import { InvoiceStatusEnum } from '@contracts/invoices.types';
import type { PortalBankTransferResponse } from '@contracts/portal.types';
import { NotFoundError } from '@errors/app.error';
import { CurrencyEnum } from '@utils/currency';
import { buildTransferContent, buildVietQrPayload } from '@utils/vietqr';
import type { FastifyInstance } from 'fastify';

export interface BankTransferConfig {
  bankBin: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
}

export class BankTransferService {
  constructor(
    private readonly fastify: FastifyInstance,
    private readonly bankTransferConfig: BankTransferConfig | null,
  ) {}

  async getCustomerBankTransfer(
    customerId: string,
    invoiceId: string,
  ): Promise<PortalBankTransferResponse> {
    const invoice = await this.fastify.invoiceService.getCustomerInvoice(customerId, invoiceId);

    const { bankTransferConfig } = this;

    const isPayable =
      invoice.status === InvoiceStatusEnum.OPEN &&
      invoice.amountRemaining > 0 &&
      invoice.currency === CurrencyEnum.VND;

    if (bankTransferConfig && isPayable) {
      const { number } = invoice;

      const transferContent = buildTransferContent(number || invoice.id);

      return {
        invoiceId: invoice.id,
        ...bankTransferConfig,
        amount: invoice.amountRemaining,
        currency: invoice.currency,
        transferContent,
        qrPayload: buildVietQrPayload({
          bankBin: bankTransferConfig.bankBin,
          accountNumber: bankTransferConfig.accountNumber,
          amount: invoice.amountRemaining,
          content: transferContent,
        }),
      };
    }

    throw new NotFoundError(`No bank transfer is available for invoice ${invoiceId}`);
  }
}
