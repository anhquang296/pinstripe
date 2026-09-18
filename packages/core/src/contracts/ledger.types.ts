import type { Static } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';
import type { Currency } from '@utils/currency';
import { CurrencyEnum } from '@utils/currency';

export enum LedgerAccountCodeEnum {
  ACCOUNTS_RECEIVABLE = 'accounts_receivable',
  CASH = 'cash',
  REVENUE = 'revenue',
  DEFERRED_REVENUE = 'deferred_revenue',
  TAX_PAYABLE = 'tax_payable',
  CUSTOMER_CREDIT_BALANCE = 'customer_credit_balance',
  ROUNDING_DIFFERENCE = 'rounding_difference',
  PSP_RECEIVABLE = 'psp_receivable',
  PSP_FEES = 'psp_fees',
  DISPUTES_HELD = 'disputes_held',
  PAYOUTS_CLEARING = 'payouts_clearing',
  TICKET_OFFSET_CLEARING = 'ticket_offset_clearing',
  PARTNER_WALLET_CLEARING = 'partner_wallet_clearing',
}
export type LedgerAccountCode = `${LedgerAccountCodeEnum}`;

export enum LedgerAccountTypeEnum {
  ASSET = 'asset',
  LIABILITY = 'liability',
  EQUITY = 'equity',
  REVENUE = 'revenue',
  EXPENSE = 'expense',
}
export type LedgerAccountType = `${LedgerAccountTypeEnum}`;

export enum PostingDirectionEnum {
  DEBIT = 'debit',
  CREDIT = 'credit',
}
export type PostingDirection = `${PostingDirectionEnum}`;

export interface LedgerAccountDefinition {
  type: LedgerAccountType;
  normalBalance: PostingDirection;
  isPerCustomer: boolean;
}

export const LEDGER_ACCOUNT_DEFINITIONS: Record<LedgerAccountCode, LedgerAccountDefinition> = {
  [LedgerAccountCodeEnum.ACCOUNTS_RECEIVABLE]: {
    type: LedgerAccountTypeEnum.ASSET,
    normalBalance: PostingDirectionEnum.DEBIT,
    isPerCustomer: true,
  },
  [LedgerAccountCodeEnum.CASH]: {
    type: LedgerAccountTypeEnum.ASSET,
    normalBalance: PostingDirectionEnum.DEBIT,
    isPerCustomer: false,
  },
  [LedgerAccountCodeEnum.REVENUE]: {
    type: LedgerAccountTypeEnum.REVENUE,
    normalBalance: PostingDirectionEnum.CREDIT,
    isPerCustomer: false,
  },
  [LedgerAccountCodeEnum.DEFERRED_REVENUE]: {
    type: LedgerAccountTypeEnum.LIABILITY,
    normalBalance: PostingDirectionEnum.CREDIT,
    isPerCustomer: false,
  },
  [LedgerAccountCodeEnum.TAX_PAYABLE]: {
    type: LedgerAccountTypeEnum.LIABILITY,
    normalBalance: PostingDirectionEnum.CREDIT,
    isPerCustomer: false,
  },
  [LedgerAccountCodeEnum.CUSTOMER_CREDIT_BALANCE]: {
    type: LedgerAccountTypeEnum.LIABILITY,
    normalBalance: PostingDirectionEnum.CREDIT,
    isPerCustomer: true,
  },
  [LedgerAccountCodeEnum.ROUNDING_DIFFERENCE]: {
    type: LedgerAccountTypeEnum.EXPENSE,
    normalBalance: PostingDirectionEnum.DEBIT,
    isPerCustomer: false,
  },
  [LedgerAccountCodeEnum.PSP_RECEIVABLE]: {
    type: LedgerAccountTypeEnum.ASSET,
    normalBalance: PostingDirectionEnum.DEBIT,
    isPerCustomer: false,
  },
  [LedgerAccountCodeEnum.PSP_FEES]: {
    type: LedgerAccountTypeEnum.EXPENSE,
    normalBalance: PostingDirectionEnum.DEBIT,
    isPerCustomer: false,
  },
  [LedgerAccountCodeEnum.DISPUTES_HELD]: {
    type: LedgerAccountTypeEnum.ASSET,
    normalBalance: PostingDirectionEnum.DEBIT,
    isPerCustomer: false,
  },
  [LedgerAccountCodeEnum.PAYOUTS_CLEARING]: {
    type: LedgerAccountTypeEnum.ASSET,
    normalBalance: PostingDirectionEnum.DEBIT,
    isPerCustomer: false,
  },
  [LedgerAccountCodeEnum.TICKET_OFFSET_CLEARING]: {
    type: LedgerAccountTypeEnum.ASSET,
    normalBalance: PostingDirectionEnum.DEBIT,
    isPerCustomer: false,
  },
  [LedgerAccountCodeEnum.PARTNER_WALLET_CLEARING]: {
    type: LedgerAccountTypeEnum.ASSET,
    normalBalance: PostingDirectionEnum.DEBIT,
    isPerCustomer: false,
  },
};

export const ledgerAccountSchema = Type.Object({
  id: Type.String(),
  code: Type.Unsafe<LedgerAccountCode>(Type.Enum(LedgerAccountCodeEnum)),
  type: Type.Unsafe<LedgerAccountType>(Type.Enum(LedgerAccountTypeEnum)),
  normalBalance: Type.Unsafe<PostingDirection>(Type.Enum(PostingDirectionEnum)),
  currency: Type.Unsafe<Currency>(Type.Enum(CurrencyEnum)),
  customerId: Type.Union([Type.String(), Type.Null()]),
  debits: Type.Integer(),
  credits: Type.Integer(),
  balance: Type.Integer(),
  createdAt: Type.String(),
});

export const ledgerPostingSchema = Type.Object({
  id: Type.String(),
  transactionId: Type.String(),
  accountId: Type.String(),
  accountCode: Type.Unsafe<LedgerAccountCode>(Type.Enum(LedgerAccountCodeEnum)),
  direction: Type.Unsafe<PostingDirection>(Type.Enum(PostingDirectionEnum)),
  amount: Type.Integer(),
  currency: Type.Unsafe<Currency>(Type.Enum(CurrencyEnum)),
  createdAt: Type.String(),
});

export const ledgerTransactionSchema = Type.Object({
  id: Type.String(),
  description: Type.String(),
  currency: Type.Unsafe<Currency>(Type.Enum(CurrencyEnum)),
  externalId: Type.Union([Type.String(), Type.Null()]),
  effectiveAt: Type.String(),
  reversesTransactionId: Type.Union([Type.String(), Type.Null()]),
  reversedByTransactionId: Type.Union([Type.String(), Type.Null()]),
  metadata: Type.Record(Type.String(), Type.String()),
  postings: Type.Array(ledgerPostingSchema),
  createdAt: Type.String(),
});

export const ledgerTransactionParamsSchema = Type.Object({
  transactionId: Type.String(),
});

export const ledgerAccountParamsSchema = Type.Object({
  accountId: Type.String(),
});

export const postLedgerTransactionSchema = Type.Object(
  {
    description: Type.String({ minLength: 1 }),
    currency: Type.Unsafe<Currency>(Type.Enum(CurrencyEnum)),
    effectiveAt: Type.Optional(Type.String({ format: 'date-time' })),
    externalId: Type.Optional(Type.String({ minLength: 1 })),
    metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
    entries: Type.Array(
      Type.Object({
        accountId: Type.Optional(Type.String()),
        accountCode: Type.Optional(
          Type.Unsafe<LedgerAccountCode>(Type.Enum(LedgerAccountCodeEnum)),
        ),
        customerId: Type.Optional(Type.String()),
        direction: Type.Unsafe<PostingDirection>(Type.Enum(PostingDirectionEnum)),
        amount: Type.Integer({ minimum: 1 }),
      }),
      { minItems: 2 },
    ),
  },
  { additionalProperties: false },
);

export const reverseLedgerTransactionSchema = Type.Object(
  {
    reason: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

export const findLedgerTransactionsSchema = Type.Object(
  {
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
    startingAfter: Type.Optional(Type.String()),
    endingBefore: Type.Optional(Type.String()),
    accountId: Type.Optional(Type.String()),
    customerId: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export const findLedgerAccountsSchema = Type.Object(
  {
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 100 })),
    startingAfter: Type.Optional(Type.String()),
    endingBefore: Type.Optional(Type.String()),
    customerId: Type.Optional(Type.String()),
    code: Type.Optional(Type.Unsafe<LedgerAccountCode>(Type.Enum(LedgerAccountCodeEnum))),
  },
  { additionalProperties: false },
);

export type LedgerAccountResponse = Static<typeof ledgerAccountSchema>;
export type LedgerPostingResponse = Static<typeof ledgerPostingSchema>;
export type LedgerTransactionResponse = Static<typeof ledgerTransactionSchema>;
export type PostLedgerTransactionPayload = Static<typeof postLedgerTransactionSchema>;
export type ReverseLedgerTransactionPayload = Static<typeof reverseLedgerTransactionSchema>;
export type FindLedgerTransactionsQuery = Static<typeof findLedgerTransactionsSchema>;
export type FindLedgerAccountsQuery = Static<typeof findLedgerAccountsSchema>;
