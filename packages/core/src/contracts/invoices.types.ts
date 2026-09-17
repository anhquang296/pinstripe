import type { Static } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';
import type { Currency } from '@utils/currency';
import { CurrencyEnum } from '@utils/currency';
import type { LineItemType } from '@utils/rating';
import { LineItemTypeEnum } from '@utils/rating';

export enum InvoiceStatusEnum {
  DRAFT = 'draft',
  OPEN = 'open',
  PAID = 'paid',
  VOID = 'void',
  UNCOLLECTIBLE = 'uncollectible',
}
export type InvoiceStatus = `${InvoiceStatusEnum}`;

export enum NumberSequenceEnum {
  INVOICE = 'invoice',
  CREDIT_NOTE = 'credit_note',
}
export type NumberSequence = `${NumberSequenceEnum}`;

export enum BillingReasonEnum {
  SUBSCRIPTION_CYCLE = 'subscription_cycle',
  SUBSCRIPTION_UPDATE = 'subscription_update',
}
export type BillingReason = `${BillingReasonEnum}`;

export const INVOICE_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  [InvoiceStatusEnum.DRAFT]: [InvoiceStatusEnum.OPEN, InvoiceStatusEnum.VOID],
  [InvoiceStatusEnum.OPEN]: [
    InvoiceStatusEnum.PAID,
    InvoiceStatusEnum.VOID,
    InvoiceStatusEnum.UNCOLLECTIBLE,
  ],
  [InvoiceStatusEnum.PAID]: [],
  [InvoiceStatusEnum.VOID]: [],
  [InvoiceStatusEnum.UNCOLLECTIBLE]: [InvoiceStatusEnum.PAID],
};

export const invoiceSchema = Type.Object({
  object: Type.Literal('invoice'),
  id: Type.String(),
  number: Type.Union([Type.String(), Type.Null()]),
  customerId: Type.String(),
  customer: Type.Optional(Type.Unknown()),
  subscriptionId: Type.Union([Type.String(), Type.Null()]),
  subscription: Type.Optional(Type.Unknown()),
  status: Type.Unsafe<InvoiceStatus>(Type.Enum(InvoiceStatusEnum)),
  billingReason: Type.Unsafe<BillingReason>(Type.Enum(BillingReasonEnum)),
  currency: Type.Unsafe<Currency>(Type.Enum(CurrencyEnum)),
  periodStart: Type.String(),
  periodEnd: Type.String(),
  subtotal: Type.Integer(),
  total: Type.Integer(),
  amountPaid: Type.Integer(),
  amountCredited: Type.Integer(),
  amountRefunded: Type.Integer(),
  amountRemaining: Type.Integer(),
  lineItems: Type.Array(
    Type.Object({
      object: Type.Literal('line_item'),
      id: Type.String(),
      subscriptionItemId: Type.Union([Type.String(), Type.Null()]),
      priceId: Type.String(),
      type: Type.Unsafe<LineItemType>(Type.Enum(LineItemTypeEnum)),
      quantity: Type.Number(),
      amount: Type.Integer(),
      periodStart: Type.String(),
      periodEnd: Type.String(),
      prorationFactor: Type.Number(),
    }),
  ),
  finalizedAt: Type.Union([Type.String(), Type.Null()]),
  paidAt: Type.Union([Type.String(), Type.Null()]),
  voidedAt: Type.Union([Type.String(), Type.Null()]),
  metadata: Type.Record(Type.String(), Type.String()),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

export const creditNoteSchema = Type.Object({
  object: Type.Literal('credit_note'),
  id: Type.String(),
  number: Type.String(),
  invoiceId: Type.String(),
  customerId: Type.String(),
  customer: Type.Optional(Type.Unknown()),
  currency: Type.Unsafe<Currency>(Type.Enum(CurrencyEnum)),
  amount: Type.Integer(),
  reason: Type.String(),
  metadata: Type.Record(Type.String(), Type.String()),
  createdAt: Type.String(),
});

export const invoiceParamsSchema = Type.Object({
  invoiceId: Type.String(),
});

export const createInvoiceSchema = Type.Object(
  {
    subscriptionId: Type.String({ minLength: 1 }),
    metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
  },
  { additionalProperties: false },
);

export const voidInvoiceSchema = Type.Object(
  { metadata: Type.Optional(Type.Record(Type.String(), Type.String())) },
  { additionalProperties: false },
);

export const payInvoiceSchema = Type.Object(
  {
    amount: Type.Optional(Type.Integer({ minimum: 1 })),
    metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
  },
  { additionalProperties: false },
);

export const createCreditNoteSchema = Type.Object(
  {
    invoiceId: Type.String({ minLength: 1 }),
    amount: Type.Integer({ minimum: 1 }),
    reason: Type.String({ minLength: 1 }),
    metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
  },
  { additionalProperties: false },
);

export const findInvoicesSchema = Type.Object(
  {
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
    startingAfter: Type.Optional(Type.String()),
    endingBefore: Type.Optional(Type.String()),
    customerId: Type.Optional(Type.String()),
    subscriptionId: Type.Optional(Type.String()),
    status: Type.Optional(Type.Unsafe<InvoiceStatus>(Type.Enum(InvoiceStatusEnum))),
  },
  { additionalProperties: false },
);

export const findCreditNotesSchema = Type.Object(
  {
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
    startingAfter: Type.Optional(Type.String()),
    endingBefore: Type.Optional(Type.String()),
    invoiceId: Type.Optional(Type.String()),
    customerId: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export type InvoiceResponse = Static<typeof invoiceSchema>;
export type CreditNoteResponse = Static<typeof creditNoteSchema>;
export type CreateInvoicePayload = Static<typeof createInvoiceSchema>;
export type VoidInvoicePayload = Static<typeof voidInvoiceSchema>;
export type PayInvoicePayload = Static<typeof payInvoiceSchema>;
export type CreateCreditNotePayload = Static<typeof createCreditNoteSchema>;
export type FindInvoicesQuery = Static<typeof findInvoicesSchema>;
export type FindCreditNotesQuery = Static<typeof findCreditNotesSchema>;
