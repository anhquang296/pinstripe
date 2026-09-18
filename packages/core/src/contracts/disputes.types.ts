import type { Static } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';
import type { Currency } from '@utils/currency';
import { CurrencyEnum } from '@utils/currency';

export enum DisputeStatusEnum {
  NEEDS_RESPONSE = 'needs_response',
  UNDER_REVIEW = 'under_review',
  WON = 'won',
  LOST = 'lost',
}
export type DisputeStatus = `${DisputeStatusEnum}`;

export enum DisputeReasonEnum {
  FRAUDULENT = 'fraudulent',
  DUPLICATE = 'duplicate',
  PRODUCT_NOT_RECEIVED = 'product_not_received',
  SUBSCRIPTION_CANCELED = 'subscription_canceled',
  CREDIT_NOT_PROCESSED = 'credit_not_processed',
  GENERAL = 'general',
}
export type DisputeReason = `${DisputeReasonEnum}`;

export enum DisputeOutcomeEnum {
  WON = 'won',
  LOST = 'lost',
}
export type DisputeOutcome = `${DisputeOutcomeEnum}`;

export const DISPUTE_TRANSITIONS: Record<DisputeStatus, DisputeStatus[]> = {
  [DisputeStatusEnum.NEEDS_RESPONSE]: [
    DisputeStatusEnum.UNDER_REVIEW,
    DisputeStatusEnum.WON,
    DisputeStatusEnum.LOST,
  ],
  [DisputeStatusEnum.UNDER_REVIEW]: [DisputeStatusEnum.WON, DisputeStatusEnum.LOST],
  [DisputeStatusEnum.WON]: [],
  [DisputeStatusEnum.LOST]: [],
};

export const disputeEvidenceSchema = Type.Object({
  productDescription: Type.Optional(Type.String()),
  customerName: Type.Optional(Type.String()),
  billingAddress: Type.Optional(Type.String()),
  receipt: Type.Optional(Type.String()),
  serviceDate: Type.Optional(Type.String()),
  uncategorizedText: Type.Optional(Type.String()),
});

export const disputeSchema = Type.Object({
  id: Type.String(),
  chargeId: Type.String(),
  paymentIntentId: Type.String(),
  invoiceId: Type.Union([Type.String(), Type.Null()]),
  customerId: Type.String(),
  customer: Type.Optional(Type.Unknown()),
  currency: Type.Unsafe<Currency>(Type.Enum(CurrencyEnum)),
  amount: Type.Integer(),
  status: Type.Unsafe<DisputeStatus>(Type.Enum(DisputeStatusEnum)),
  reason: Type.Unsafe<DisputeReason>(Type.Enum(DisputeReasonEnum)),
  evidence: disputeEvidenceSchema,
  evidenceSubmittedAt: Type.Union([Type.String(), Type.Null()]),
  closedAt: Type.Union([Type.String(), Type.Null()]),
  pspReference: Type.String(),
  metadata: Type.Record(Type.String(), Type.String()),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

export const disputeParamsSchema = Type.Object({
  disputeId: Type.String(),
});

export const submitDisputeEvidenceSchema = Type.Object(
  {
    evidence: disputeEvidenceSchema,
    metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
  },
  { additionalProperties: false },
);

export const findDisputesSchema = Type.Object(
  {
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
    startingAfter: Type.Optional(Type.String()),
    endingBefore: Type.Optional(Type.String()),
    chargeId: Type.Optional(Type.String()),
    customerId: Type.Optional(Type.String()),
    status: Type.Optional(Type.Unsafe<DisputeStatus>(Type.Enum(DisputeStatusEnum))),
    expand: Type.Optional(Type.Array(Type.String())),
  },
  { additionalProperties: false },
);

export type DisputeResponse = Static<typeof disputeSchema>;
export type DisputeEvidence = Static<typeof disputeEvidenceSchema>;
export type SubmitDisputeEvidencePayload = Static<typeof submitDisputeEvidenceSchema>;
export type FindDisputesQuery = Static<typeof findDisputesSchema>;
