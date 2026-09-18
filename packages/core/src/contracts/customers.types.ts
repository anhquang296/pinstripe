import type { TaxExempt } from '@contracts/taxes.types';
import { TaxExemptEnum } from '@contracts/taxes.types';
import type { Static } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';
import type { Currency } from '@utils/currency';
import { CurrencyEnum } from '@utils/currency';

export enum CustomerBalanceTransactionTypeEnum {
  ADJUSTMENT = 'adjustment',
  APPLIED_TO_INVOICE = 'applied_to_invoice',
  CREDIT_NOTE = 'credit_note',
  INVOICE_OVERPAID = 'invoice_overpaid',
  UNAPPLIED_FROM_INVOICE = 'unapplied_from_invoice',
}
export type CustomerBalanceTransactionType = `${CustomerBalanceTransactionTypeEnum}`;

export const customerSchema = Type.Object({
  id: Type.String(),
  email: Type.Union([Type.String(), Type.Null()]),
  name: Type.String(),
  description: Type.String(),
  phone: Type.String(),
  taxId: Type.Union([Type.String(), Type.Null()]),
  taxExempt: Type.Unsafe<TaxExempt>(Type.Enum(TaxExemptEnum)),
  address: Type.Union([
    Type.Object({
      line1: Type.Optional(Type.String()),
      line2: Type.Optional(Type.String()),
      city: Type.Optional(Type.String()),
      state: Type.Optional(Type.String()),
      postalCode: Type.Optional(Type.String()),
      country: Type.Optional(Type.String()),
    }),
    Type.Null(),
  ]),
  currency: Type.Unsafe<Currency>(Type.Enum(CurrencyEnum)),
  defaultPaymentMethodId: Type.Union([Type.String(), Type.Null()]),
  testClockId: Type.Union([Type.String(), Type.Null()]),
  balance: Type.Integer(),
  metadata: Type.Record(Type.String(), Type.String()),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

export const customerParamsSchema = Type.Object({
  customerId: Type.String(),
});

export const createCustomerSchema = Type.Object(
  {
    email: Type.Optional(Type.String({ format: 'email' })),
    name: Type.Optional(Type.String({ minLength: 1 })),
    description: Type.Optional(Type.String()),
    phone: Type.Optional(Type.String()),
    taxId: Type.Optional(Type.String()),
    taxExempt: Type.Optional(Type.Unsafe<TaxExempt>(Type.Enum(TaxExemptEnum))),
    address: Type.Optional(
      Type.Object({
        line1: Type.Optional(Type.String()),
        line2: Type.Optional(Type.String()),
        city: Type.Optional(Type.String()),
        state: Type.Optional(Type.String()),
        postalCode: Type.Optional(Type.String()),
        country: Type.Optional(Type.String()),
      }),
    ),
    currency: Type.Unsafe<Currency>(Type.Enum(CurrencyEnum)),
    defaultPaymentMethodId: Type.Optional(Type.String({ minLength: 1 })),
    testClockId: Type.Optional(Type.String({ minLength: 1 })),
    metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
  },
  { additionalProperties: false },
);

export const updateCustomerSchema = Type.Object(
  {
    email: Type.Optional(Type.String({ format: 'email' })),
    name: Type.Optional(Type.String({ minLength: 1 })),
    description: Type.Optional(Type.String()),
    phone: Type.Optional(Type.String()),
    taxId: Type.Optional(Type.String()),
    taxExempt: Type.Optional(Type.Unsafe<TaxExempt>(Type.Enum(TaxExemptEnum))),
    address: Type.Optional(
      Type.Object({
        line1: Type.Optional(Type.String()),
        line2: Type.Optional(Type.String()),
        city: Type.Optional(Type.String()),
        state: Type.Optional(Type.String()),
        postalCode: Type.Optional(Type.String()),
        country: Type.Optional(Type.String()),
      }),
    ),
    defaultPaymentMethodId: Type.Optional(Type.Union([Type.String({ minLength: 1 }), Type.Null()])),
    metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
  },
  { additionalProperties: false },
);

export const findCustomersSchema = Type.Object(
  {
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
    startingAfter: Type.Optional(Type.String()),
    endingBefore: Type.Optional(Type.String()),
    email: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export const deletedCustomerSchema = Type.Object({
  id: Type.String(),
  deleted: Type.Literal(true),
});

export const customerBalanceTransactionSchema = Type.Object({
  id: Type.String(),
  customerId: Type.String(),
  customer: Type.Optional(Type.Unknown()),
  invoiceId: Type.Union([Type.String(), Type.Null()]),
  creditNoteId: Type.Union([Type.String(), Type.Null()]),
  type: Type.Unsafe<CustomerBalanceTransactionType>(Type.Enum(CustomerBalanceTransactionTypeEnum)),
  currency: Type.Unsafe<Currency>(Type.Enum(CurrencyEnum)),
  amount: Type.Integer(),
  endingBalance: Type.Integer(),
  description: Type.String(),
  metadata: Type.Record(Type.String(), Type.String()),
  createdAt: Type.String(),
});

export const createCustomerBalanceTransactionSchema = Type.Object(
  {
    amount: Type.Integer(),
    currency: Type.Unsafe<Currency>(Type.Enum(CurrencyEnum)),
    description: Type.Optional(Type.String()),
    metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
  },
  { additionalProperties: false },
);

export const findCustomerBalanceTransactionsSchema = Type.Object(
  {
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
    startingAfter: Type.Optional(Type.String()),
    endingBefore: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export type CustomerResponse = Static<typeof customerSchema>;
export type CustomerBalanceTransactionResponse = Static<typeof customerBalanceTransactionSchema>;
export type CreateCustomerBalanceTransactionPayload = Static<
  typeof createCustomerBalanceTransactionSchema
>;
export type FindCustomerBalanceTransactionsQuery = Static<
  typeof findCustomerBalanceTransactionsSchema
>;
export type DeletedCustomerResponse = Static<typeof deletedCustomerSchema>;
export type CreateCustomerPayload = Static<typeof createCustomerSchema>;
export type UpdateCustomerPayload = Static<typeof updateCustomerSchema>;
export type FindCustomersQuery = Static<typeof findCustomersSchema>;
