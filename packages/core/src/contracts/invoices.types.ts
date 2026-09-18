import type { CollectionMethod } from '@contracts/subscriptions.types';
import { CollectionMethodEnum } from '@contracts/subscriptions.types';
import type { AuthorityStatus, AutomaticTaxStatus, TaxType } from '@contracts/taxes.types';
import { AuthorityStatusEnum, AutomaticTaxStatusEnum, TaxTypeEnum } from '@contracts/taxes.types';
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

export enum CreditNoteTypeEnum {
  PRE_PAYMENT = 'pre_payment',
  POST_PAYMENT = 'post_payment',
}
export type CreditNoteType = `${CreditNoteTypeEnum}`;

export enum CreditNoteStatusEnum {
  ISSUED = 'issued',
  VOID = 'void',
}
export type CreditNoteStatus = `${CreditNoteStatusEnum}`;

export enum BillingReasonEnum {
  SUBSCRIPTION_CREATE = 'subscription_create',
  SUBSCRIPTION_CYCLE = 'subscription_cycle',
  SUBSCRIPTION_UPDATE = 'subscription_update',
  SUBSCRIPTION_THRESHOLD = 'subscription_threshold',
  MANUAL = 'manual',
  UPCOMING = 'upcoming',
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
  collectionMethod: Type.Unsafe<CollectionMethod>(Type.Enum(CollectionMethodEnum)),
  autoAdvance: Type.Boolean(),
  daysUntilDue: Type.Union([Type.Integer(), Type.Null()]),
  attempted: Type.Boolean(),
  periodStart: Type.String(),
  periodEnd: Type.String(),
  subtotal: Type.Integer(),
  subtotalExcludingTax: Type.Integer(),
  totalDiscountAmount: Type.Integer(),
  totalTaxAmount: Type.Integer(),
  total: Type.Integer(),
  startingBalance: Type.Integer(),
  endingBalance: Type.Integer(),
  amountDue: Type.Integer(),
  amountPaid: Type.Integer(),
  defaultTaxRates: Type.Array(Type.String()),
  automaticTax: Type.Object({
    enabled: Type.Boolean(),
    status: Type.Unsafe<AutomaticTaxStatus>(Type.Enum(AutomaticTaxStatusEnum)),
  }),
  authorityInvoiceNumber: Type.Union([Type.String(), Type.Null()]),
  authorityStatus: Type.Unsafe<AuthorityStatus>(Type.Enum(AuthorityStatusEnum)),
  amountCredited: Type.Integer(),
  amountRefunded: Type.Integer(),
  amountRemaining: Type.Integer(),
  lineItems: Type.Array(
    Type.Object({
      object: Type.Literal('line_item'),
      id: Type.String(),
      subscriptionItemId: Type.Union([Type.String(), Type.Null()]),
      invoiceItemId: Type.Union([Type.String(), Type.Null()]),
      priceId: Type.Union([Type.String(), Type.Null()]),
      type: Type.Unsafe<LineItemType>(Type.Enum(LineItemTypeEnum)),
      description: Type.String(),
      quantity: Type.Number(),
      unitAmount: Type.Union([Type.Integer(), Type.Null()]),
      amount: Type.Integer(),
      amountExcludingTax: Type.Integer(),
      discountable: Type.Boolean(),
      discountAmounts: Type.Array(
        Type.Object({ discountId: Type.String(), amount: Type.Integer() }),
      ),
      taxAmounts: Type.Array(
        Type.Object({
          taxRateId: Type.String(),
          amount: Type.Integer(),
          taxableAmount: Type.Integer(),
          isInclusive: Type.Boolean(),
          percentage: Type.Number(),
          taxType: Type.Unsafe<TaxType>(Type.Enum(TaxTypeEnum)),
        }),
      ),
      periodStart: Type.String(),
      periodEnd: Type.String(),
      prorationFactor: Type.Number(),
    }),
  ),
  hostedInvoiceUrl: Type.Union([Type.String(), Type.Null()]),
  invoicePdf: Type.Union([Type.String(), Type.Null()]),
  sentAt: Type.Union([Type.String(), Type.Null()]),
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
  type: Type.Unsafe<CreditNoteType>(Type.Enum(CreditNoteTypeEnum)),
  status: Type.Unsafe<CreditNoteStatus>(Type.Enum(CreditNoteStatusEnum)),
  amount: Type.Integer(),
  refundAmount: Type.Integer(),
  outOfBandAmount: Type.Integer(),
  creditAmount: Type.Integer(),
  refundId: Type.Union([Type.String(), Type.Null()]),
  reason: Type.String(),
  lines: Type.Array(
    Type.Object({
      object: Type.Literal('credit_note_line_item'),
      id: Type.String(),
      creditNoteId: Type.String(),
      invoiceLineItemId: Type.Union([Type.String(), Type.Null()]),
      description: Type.String(),
      quantity: Type.Number(),
      unitAmount: Type.Union([Type.Integer(), Type.Null()]),
      amount: Type.Integer(),
    }),
  ),
  voidedAt: Type.Union([Type.String(), Type.Null()]),
  metadata: Type.Record(Type.String(), Type.String()),
  createdAt: Type.String(),
});

export const invoiceParamsSchema = Type.Object({
  invoiceId: Type.String(),
});

export const createInvoiceSchema = Type.Object(
  {
    customerId: Type.Optional(Type.String({ minLength: 1 })),
    subscriptionId: Type.Optional(Type.String({ minLength: 1 })),
    currency: Type.Optional(Type.Unsafe<Currency>(Type.Enum(CurrencyEnum))),
    collectionMethod: Type.Optional(Type.Unsafe<CollectionMethod>(Type.Enum(CollectionMethodEnum))),
    autoAdvance: Type.Optional(Type.Boolean()),
    daysUntilDue: Type.Optional(Type.Integer({ minimum: 0, maximum: 365 })),
    defaultTaxRates: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
    automaticTax: Type.Optional(Type.Object({ enabled: Type.Boolean() })),
    metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
  },
  { additionalProperties: false },
);

export const invoiceItemSchema = Type.Object({
  object: Type.Literal('invoiceitem'),
  id: Type.String(),
  livemode: Type.Boolean(),
  customerId: Type.String(),
  customer: Type.Optional(Type.Unknown()),
  invoiceId: Type.Union([Type.String(), Type.Null()]),
  subscriptionId: Type.Union([Type.String(), Type.Null()]),
  priceId: Type.Union([Type.String(), Type.Null()]),
  currency: Type.Unsafe<Currency>(Type.Enum(CurrencyEnum)),
  description: Type.String(),
  quantity: Type.Number(),
  unitAmount: Type.Union([Type.Integer(), Type.Null()]),
  amount: Type.Integer(),
  discountable: Type.Boolean(),
  taxRates: Type.Array(Type.String()),
  periodStart: Type.String(),
  periodEnd: Type.String(),
  metadata: Type.Record(Type.String(), Type.String()),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

export const deletedInvoiceItemSchema = Type.Object({
  object: Type.Literal('invoiceitem'),
  id: Type.String(),
  deleted: Type.Literal(true),
});

export const invoiceItemParamsSchema = Type.Object({
  invoiceItemId: Type.String(),
});

export const createInvoiceItemSchema = Type.Object(
  {
    customerId: Type.String({ minLength: 1 }),
    invoiceId: Type.Optional(Type.String({ minLength: 1 })),
    subscriptionId: Type.Optional(Type.String({ minLength: 1 })),
    priceId: Type.Optional(Type.String({ minLength: 1 })),
    currency: Type.Optional(Type.Unsafe<Currency>(Type.Enum(CurrencyEnum))),
    description: Type.Optional(Type.String()),
    quantity: Type.Optional(Type.Number({ minimum: 0 })),
    unitAmount: Type.Optional(Type.Integer()),
    amount: Type.Optional(Type.Integer()),
    discountable: Type.Optional(Type.Boolean()),
    taxRates: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
    periodStart: Type.Optional(Type.String({ format: 'date-time' })),
    periodEnd: Type.Optional(Type.String({ format: 'date-time' })),
    metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
  },
  { additionalProperties: false },
);

export const updateInvoiceItemSchema = Type.Object(
  {
    description: Type.Optional(Type.String()),
    quantity: Type.Optional(Type.Number({ minimum: 0 })),
    unitAmount: Type.Optional(Type.Integer()),
    amount: Type.Optional(Type.Integer()),
    discountable: Type.Optional(Type.Boolean()),
    taxRates: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
    metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
  },
  { additionalProperties: false },
);

export const findInvoiceItemsSchema = Type.Object(
  {
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
    startingAfter: Type.Optional(Type.String()),
    endingBefore: Type.Optional(Type.String()),
    customerId: Type.Optional(Type.String()),
    invoiceId: Type.Optional(Type.String()),
    isPending: Type.Optional(Type.Boolean()),
    expand: Type.Optional(Type.Array(Type.String())),
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
    lines: Type.Array(
      Type.Object(
        {
          invoiceLineItemId: Type.Optional(Type.String({ minLength: 1 })),
          description: Type.Optional(Type.String()),
          quantity: Type.Optional(Type.Number({ minimum: 0 })),
          unitAmount: Type.Optional(Type.Integer({ minimum: 0 })),
          amount: Type.Integer({ minimum: 1 }),
        },
        { additionalProperties: false },
      ),
      { minItems: 1 },
    ),
    refundAmount: Type.Optional(Type.Integer({ minimum: 0 })),
    outOfBandAmount: Type.Optional(Type.Integer({ minimum: 0 })),
    reason: Type.String({ minLength: 1 }),
    metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
  },
  { additionalProperties: false },
);

export const voidCreditNoteSchema = Type.Object(
  {
    reason: Type.Optional(Type.String({ minLength: 1 })),
    metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
  },
  { additionalProperties: false },
);

export const creditNoteParamsSchema = Type.Object({
  creditNoteId: Type.String(),
});

export const findInvoicesSchema = Type.Object(
  {
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
    startingAfter: Type.Optional(Type.String()),
    endingBefore: Type.Optional(Type.String()),
    customerId: Type.Optional(Type.String()),
    subscriptionId: Type.Optional(Type.String()),
    status: Type.Optional(Type.Unsafe<InvoiceStatus>(Type.Enum(InvoiceStatusEnum))),
    expand: Type.Optional(Type.Array(Type.String())),
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
    expand: Type.Optional(Type.Array(Type.String())),
  },
  { additionalProperties: false },
);

export type InvoiceResponse = Static<typeof invoiceSchema>;
export type InvoiceItemResponse = Static<typeof invoiceItemSchema>;
export type DeletedInvoiceItemResponse = Static<typeof deletedInvoiceItemSchema>;
export type CreateInvoiceItemPayload = Static<typeof createInvoiceItemSchema>;
export type UpdateInvoiceItemPayload = Static<typeof updateInvoiceItemSchema>;
export type FindInvoiceItemsQuery = Static<typeof findInvoiceItemsSchema>;
export type CreditNoteResponse = Static<typeof creditNoteSchema>;
export type CreateInvoicePayload = Static<typeof createInvoiceSchema>;
export type VoidInvoicePayload = Static<typeof voidInvoiceSchema>;
export type PayInvoicePayload = Static<typeof payInvoiceSchema>;
export type CreateCreditNotePayload = Static<typeof createCreditNoteSchema>;
export type VoidCreditNotePayload = Static<typeof voidCreditNoteSchema>;
export type CreditNoteLineItemResponse = CreditNoteResponse['lines'][number];
export type FindInvoicesQuery = Static<typeof findInvoicesSchema>;
export type FindCreditNotesQuery = Static<typeof findCreditNotesSchema>;
