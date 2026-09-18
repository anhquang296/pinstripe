import { LedgerAccountCodeEnum } from '@contracts/ledger.types';
import { ChargeStatusEnum, RefundStatusEnum } from '@contracts/payments.types';
import type {
  AggregateReconciliationReportQuery,
  ReconciliationReportResponse,
} from '@contracts/reporting.types';
import { ReconciliationOutcomeEnum } from '@contracts/reporting.types';
import type { RowCursor } from '@repositories/cursor';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

const PAGE_SIZE = 200;
const CHARGE_SOURCE = 'charge';
const REFUND_SOURCE = 'refund';

type ReconciliationException = ReconciliationReportResponse['exceptions'][number];

interface SettledCharge {
  id: string;
  amountCaptured: number;
  invoiceId: string | null;
}

interface ProcessorMovement {
  reference: string;
  source: string;
  amount: number;
  invoiceAmount: number | null;
}

export class ReconciliationService {
  constructor(private readonly fastify: FastifyInstance) {}

  async aggregateReconciliationReport(
    query: AggregateReconciliationReportQuery,
    livemode: boolean,
  ): Promise<ReconciliationReportResponse> {
    const windowStart = new Date(query.windowStart);
    const windowEnd = new Date(query.windowEnd);
    const charges = await this.findSettledCharges(windowStart, windowEnd, livemode);
    const settlementByChargeId = await this.resolveInvoiceSettlements(
      _.map(charges, 'id'),
      livemode,
    );
    const processorMovements = await this.resolveProcessorMovements(
      charges,
      windowStart,
      windowEnd,
      livemode,
      settlementByChargeId,
    );
    const ledgerAmountByExternalId = await this.resolveLedgerMovements(
      windowStart,
      windowEnd,
      livemode,
    );
    const exceptions: ReconciliationException[] = [];

    let matched = 0;

    for (const movement of processorMovements) {
      const exception = ReconciliationService.reconcileMovement(
        movement,
        ledgerAmountByExternalId[movement.reference],
      );

      if (exception) {
        exceptions.push(exception);

        continue;
      }

      matched += 1;
    }

    const processorReferences = new Set(_.map(processorMovements, 'reference'));

    for (const [externalId, ledgerAmount] of _.toPairs(ledgerAmountByExternalId)) {
      if (processorReferences.has(externalId)) {
        continue;
      }

      exceptions.push({
        object: 'reconciliation_exception',
        outcome: ReconciliationOutcomeEnum.MISSING_IN_PROCESSOR,
        reference: externalId,
        source: 'ledger',
        processorAmount: null,
        ledgerAmount,
        invoiceAmount: null,
      });
    }

    const processorTotal = _.sumBy(processorMovements, 'amount');
    const ledgerTotal = _.sum(_.values(ledgerAmountByExternalId));

    return {
      object: 'reconciliation_report',
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      processorTotal,
      ledgerTotal,
      invoiceTotal: _.sum(_.values(settlementByChargeId)),
      difference: processorTotal - ledgerTotal,
      scanned: processorMovements.length,
      matched,
      exceptions,
    };
  }

  private async resolveProcessorMovements(
    charges: readonly SettledCharge[],
    windowStart: Date,
    windowEnd: Date,
    livemode: boolean,
    settlementByChargeId: Record<string, number>,
  ): Promise<ProcessorMovement[]> {
    const refunds = await this.findSettledRefunds(windowStart, windowEnd, livemode);

    const payments = _.map(charges, (charge): ProcessorMovement => {
      return {
        reference: `charge:${charge.id}`,
        source: CHARGE_SOURCE,
        amount: charge.amountCaptured,
        invoiceAmount: charge.invoiceId ? _.get(settlementByChargeId, charge.id, 0) : null,
      };
    });
    const returns = _.map(refunds, (refund): ProcessorMovement => {
      return {
        reference: `refund:${refund.id}`,
        source: REFUND_SOURCE,
        amount: -refund.amount,
        invoiceAmount: null,
      };
    });

    return [...payments, ...returns];
  }

  private async findSettledCharges(
    windowStart: Date,
    windowEnd: Date,
    livemode: boolean,
  ): Promise<SettledCharge[]> {
    const settled: SettledCharge[] = [];

    let afterAt: RowCursor | undefined = undefined;

    for (;;) {
      const page = await this.fastify.paymentIntentRepository.findCharges(
        {
          livemode,
          status: ChargeStatusEnum.SUCCEEDED,
          createdAfterAt: windowStart,
          createdBeforeAt: windowEnd,
          afterAt,
        },
        PAGE_SIZE,
      );

      if (_.isEmpty(page)) {
        return settled;
      }

      const paymentIntentIds = _.uniq(_.map(page, 'paymentIntentId'));
      const paymentIntents = await this.fastify.paymentIntentRepository.findPaymentIntents(
        { ids: paymentIntentIds },
        paymentIntentIds.length,
      );
      const invoiceIdByPaymentIntentId = _(paymentIntents)
        .keyBy('id')
        .mapValues('invoiceId')
        .value();

      for (const charge of page) {
        settled.push({
          id: charge.id,
          amountCaptured: charge.amountCaptured,
          invoiceId: _.get(invoiceIdByPaymentIntentId, charge.paymentIntentId, null),
        });
      }

      const last = _.last(page);

      if (!last || page.length < PAGE_SIZE) {
        return settled;
      }

      afterAt = { createdAt: last.createdAt, id: last.id };
    }
  }

  private async findSettledRefunds(windowStart: Date, windowEnd: Date, livemode: boolean) {
    const settled: { id: string; amount: number }[] = [];

    let beforeAt: RowCursor | undefined = undefined;

    for (;;) {
      const page = await this.fastify.refundRepository.findRefunds(
        {
          livemode,
          statuses: [RefundStatusEnum.SUCCEEDED],
          createdAfterAt: windowStart,
          createdBeforeAt: windowEnd,
          beforeAt,
        },
        PAGE_SIZE,
      );

      if (_.isEmpty(page)) {
        return settled;
      }

      for (const refund of page) {
        settled.push({ id: refund.id, amount: refund.amount });
      }

      const last = _.last(page);

      if (!last || page.length < PAGE_SIZE) {
        return settled;
      }

      beforeAt = { createdAt: last.createdAt, id: last.id };
    }
  }

  private async resolveInvoiceSettlements(
    chargeIds: readonly string[],
    livemode: boolean,
  ): Promise<Record<string, number>> {
    const settlements = await this.fastify.reportingRepository.aggregateInvoiceSettlements(
      chargeIds,
      livemode,
    );

    return _(settlements).keyBy('chargeId').mapValues('amount').value();
  }

  private async resolveLedgerMovements(
    windowStart: Date,
    windowEnd: Date,
    livemode: boolean,
  ): Promise<Record<string, number>> {
    const movements = await this.fastify.reportingRepository.aggregateLedgerMovements(
      [LedgerAccountCodeEnum.PSP_RECEIVABLE, LedgerAccountCodeEnum.PSP_FEES],
      windowStart,
      windowEnd,
      livemode,
    );

    return _(movements)
      .filter((movement) => {
        return (
          _.startsWith(movement.externalId, `${CHARGE_SOURCE}:`) ||
          _.startsWith(movement.externalId, `${REFUND_SOURCE}:`)
        );
      })
      .keyBy('externalId')
      .mapValues('amount')
      .value();
  }

  private static reconcileMovement(
    movement: ProcessorMovement,
    ledgerAmount: number | undefined,
  ): ReconciliationException | null {
    if (_.isNil(ledgerAmount)) {
      return ReconciliationService.buildException(
        ReconciliationOutcomeEnum.MISSING_IN_LEDGER,
        movement,
        null,
      );
    }

    if (ledgerAmount !== movement.amount) {
      return ReconciliationService.buildException(
        ReconciliationOutcomeEnum.AMOUNT_MISMATCH,
        movement,
        ledgerAmount,
      );
    }

    const { invoiceAmount } = movement;

    if (invoiceAmount === 0) {
      return ReconciliationService.buildException(
        ReconciliationOutcomeEnum.MISSING_IN_INVOICES,
        movement,
        ledgerAmount,
      );
    }

    if (!_.isNil(invoiceAmount) && invoiceAmount !== movement.amount) {
      return ReconciliationService.buildException(
        ReconciliationOutcomeEnum.AMOUNT_MISMATCH,
        movement,
        ledgerAmount,
      );
    }

    return null;
  }

  private static buildException(
    outcome: ReconciliationOutcomeEnum,
    movement: ProcessorMovement,
    ledgerAmount: number | null,
  ): ReconciliationException {
    return {
      object: 'reconciliation_exception',
      outcome,
      reference: movement.reference,
      source: movement.source,
      processorAmount: movement.amount,
      ledgerAmount,
      invoiceAmount: movement.invoiceAmount,
    };
  }
}
