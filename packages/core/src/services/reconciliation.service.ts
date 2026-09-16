import { PostingDirectionEnum } from '@contracts/ledger.types';
import { PaymentIntentStatusEnum } from '@contracts/payments.types';
import type {
  GetReconciliationReportQuery,
  ReconciliationReportResponse,
} from '@contracts/reporting.types';
import { ReconciliationOutcomeEnum } from '@contracts/reporting.types';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

const SCAN_LIMIT = 1_000;
const PAYMENT_SOURCE = 'payment_intent';
const REFUND_SOURCE = 'refund';

type ReconciliationException = ReconciliationReportResponse['exceptions'][number];

interface ProcessorMovement {
  reference: string;
  source: string;
  amount: number;
}

export class ReconciliationService {
  constructor(private readonly fastify: FastifyInstance) {}

  async getReconciliationReport(
    query: GetReconciliationReportQuery,
  ): Promise<ReconciliationReportResponse> {
    const windowStart = new Date(query.windowStart);
    const windowEnd = new Date(query.windowEnd);
    const processorMovements = await this.resolveProcessorMovements(windowStart, windowEnd);
    const ledgerAmountByExternalId = await this.resolveLedgerMovements(windowStart, windowEnd);
    const exceptions: ReconciliationException[] = [];

    let matched = 0;

    for (const movement of processorMovements) {
      const ledgerAmount = ledgerAmountByExternalId[movement.reference];

      if (_.isNil(ledgerAmount)) {
        exceptions.push(
          ReconciliationService.buildException(
            ReconciliationOutcomeEnum.MISSING_IN_LEDGER,
            movement,
            null,
          ),
        );

        continue;
      }

      if (ledgerAmount !== movement.amount) {
        exceptions.push(
          ReconciliationService.buildException(
            ReconciliationOutcomeEnum.AMOUNT_MISMATCH,
            movement,
            ledgerAmount,
          ),
        );

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
      difference: processorTotal - ledgerTotal,
      matched,
      exceptions,
    };
  }

  private async resolveProcessorMovements(
    windowStart: Date,
    windowEnd: Date,
  ): Promise<ProcessorMovement[]> {
    const paymentIntents = await this.fastify.paymentIntentRepository.findPaymentIntents(
      { status: PaymentIntentStatusEnum.SUCCEEDED },
      SCAN_LIMIT,
    );
    const refunds = await this.fastify.refundRepository.findRefunds({}, SCAN_LIMIT);
    const isInWindow = (createdAt: Date): boolean => {
      return createdAt >= windowStart && createdAt < windowEnd;
    };

    const payments = _(paymentIntents)
      .filter((paymentIntent) => {
        return isInWindow(paymentIntent.updatedAt);
      })
      .map((paymentIntent): ProcessorMovement => {
        return {
          reference: `payment_intent:${paymentIntent.id}`,
          source: PAYMENT_SOURCE,
          amount: paymentIntent.amount,
        };
      })
      .value();

    const returns = _(refunds)
      .filter((refund) => {
        return isInWindow(refund.createdAt);
      })
      .map((refund): ProcessorMovement => {
        return {
          reference: `refund:${refund.id}`,
          source: REFUND_SOURCE,
          amount: -refund.amount,
        };
      })
      .value();

    return [...payments, ...returns];
  }

  private async resolveLedgerMovements(
    windowStart: Date,
    windowEnd: Date,
  ): Promise<Record<string, number>> {
    const movements = await this.fastify.reportingRepository.findCashMovements(
      windowStart,
      windowEnd,
    );

    return _(movements)
      .filter((movement) => {
        return Boolean(movement.externalId);
      })
      .groupBy('externalId')
      .mapValues((group) => {
        return _.sumBy(group, (movement) => {
          return movement.direction === PostingDirectionEnum.DEBIT
            ? movement.amount
            : -movement.amount;
        });
      })
      .value();
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
    };
  }
}
