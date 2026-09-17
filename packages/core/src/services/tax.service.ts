import type { AutomaticTaxStatus } from '@contracts/taxes.types';
import { AutomaticTaxStatusEnum, TaxExemptEnum } from '@contracts/taxes.types';
import type { Customer, Invoice } from '@database/schemas';
import type { InvoiceDraftLine } from '@services/invoice.service';
import type { TaxCalculationLine } from '@type/tax-provider';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

export interface TaxedInvoiceLines {
  lines: InvoiceDraftLine[];
  automaticTaxStatus: AutomaticTaxStatus;
}

export class TaxService {
  constructor(private readonly fastify: FastifyInstance) {}

  async applyTaxes(
    invoice: Invoice,
    customer: Customer,
    lines: readonly InvoiceDraftLine[],
  ): Promise<TaxedInvoiceLines> {
    const taxedLines = _.map(lines, (line) => {
      return { ...line, taxAmounts: [...line.taxAmounts] };
    });
    const automaticTaxStatus = TaxService.resolveAutomaticTaxStatus(invoice, customer);

    if (_.isEmpty(taxedLines)) {
      return { lines: taxedLines, automaticTaxStatus };
    }

    const lineAmounts = await this.fastify.taxProvider.calculate({
      livemode: invoice.livemode,
      currency: invoice.currency,
      country: _.get(customer.address, 'country', null),
      state: _.get(customer.address, 'state', null),
      taxExempt: customer.taxExempt,
      isAutomatic: invoice.automaticTaxEnabled,
      lines: _.map(taxedLines, (line, index): TaxCalculationLine => {
        return {
          reference: String(index),
          taxableAmount: TaxService.readTaxableAmount(line),
          taxBehavior: line.taxBehavior,
          taxRateIds: TaxService.resolveTaxRateIds(line, invoice),
        };
      }),
    });

    for (const { reference, taxAmounts } of lineAmounts) {
      const line = taxedLines[Number(reference)];

      if (line) {
        line.taxAmounts = [...line.taxAmounts, ...taxAmounts];
      }
    }

    return { lines: taxedLines, automaticTaxStatus };
  }

  private static readTaxableAmount(line: InvoiceDraftLine): number {
    return line.amount - _.sumBy(line.discountAmounts, 'amount');
  }

  private static resolveTaxRateIds(line: InvoiceDraftLine, invoice: Invoice): string[] {
    if (_.isEmpty(line.taxRateIds)) {
      return invoice.defaultTaxRates;
    }

    return line.taxRateIds;
  }

  private static resolveAutomaticTaxStatus(
    invoice: Invoice,
    customer: Customer,
  ): AutomaticTaxStatus {
    if (!invoice.automaticTaxEnabled || customer.taxExempt !== TaxExemptEnum.NONE) {
      return AutomaticTaxStatusEnum.NOT_COLLECTING;
    }

    const country = _.get(customer.address, 'country', null);

    if (country) {
      return AutomaticTaxStatusEnum.COMPLETE;
    }

    return AutomaticTaxStatusEnum.REQUIRES_LOCATION_INPUTS;
  }
}
