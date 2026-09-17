import type { Static } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';
import type { Currency } from '@utils/currency';
import { CurrencyEnum } from '@utils/currency';

export enum ReconciliationOutcomeEnum {
  MATCHED = 'matched',
  MISSING_IN_LEDGER = 'missing_in_ledger',
  MISSING_IN_PROCESSOR = 'missing_in_processor',
  AMOUNT_MISMATCH = 'amount_mismatch',
}
export type ReconciliationOutcome = `${ReconciliationOutcomeEnum}`;

export const revenueSummarySchema = Type.Object({
  object: Type.Literal('revenue_summary'),
  currency: Type.Unsafe<Currency>(Type.Enum(CurrencyEnum)),
  asOf: Type.String(),
  mrr: Type.Integer(),
  arr: Type.Integer(),
  activeSubscriptions: Type.Integer(),
  trialingSubscriptions: Type.Integer(),
  canceledInWindow: Type.Integer(),
  churnRate: Type.Number(),
  invoicedInWindow: Type.Integer(),
  collectedInWindow: Type.Integer(),
  refundedInWindow: Type.Integer(),
  outstanding: Type.Integer(),
  windowStart: Type.String(),
  windowEnd: Type.String(),
});

export const reconciliationReportSchema = Type.Object({
  object: Type.Literal('reconciliation_report'),
  windowStart: Type.String(),
  windowEnd: Type.String(),
  processorTotal: Type.Integer(),
  ledgerTotal: Type.Integer(),
  difference: Type.Integer(),
  matched: Type.Integer(),
  exceptions: Type.Array(
    Type.Object({
      object: Type.Literal('reconciliation_exception'),
      outcome: Type.Unsafe<ReconciliationOutcome>(Type.Enum(ReconciliationOutcomeEnum)),
      reference: Type.String(),
      source: Type.String(),
      processorAmount: Type.Union([Type.Integer(), Type.Null()]),
      ledgerAmount: Type.Union([Type.Integer(), Type.Null()]),
    }),
  ),
});

export const aggregateRevenueSummarySchema = Type.Object(
  {
    currency: Type.Optional(Type.Unsafe<Currency>(Type.Enum(CurrencyEnum))),
    windowStart: Type.Optional(Type.String({ format: 'date-time' })),
    windowEnd: Type.Optional(Type.String({ format: 'date-time' })),
  },
  { additionalProperties: false },
);

export const aggregateReconciliationReportSchema = Type.Object(
  {
    windowStart: Type.String({ format: 'date-time' }),
    windowEnd: Type.String({ format: 'date-time' }),
  },
  { additionalProperties: false },
);

export type RevenueSummaryResponse = Static<typeof revenueSummarySchema>;
export type ReconciliationReportResponse = Static<typeof reconciliationReportSchema>;
export type AggregateRevenueSummaryQuery = Static<typeof aggregateRevenueSummarySchema>;
export type AggregateReconciliationReportQuery = Static<typeof aggregateReconciliationReportSchema>;
