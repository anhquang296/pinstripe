import {
  CurrencyEnum,
  LedgerAccountCodeEnum,
  PostingDirectionEnum,
} from '@pinstripe/core/contracts';
import { describe, expect, it } from 'vitest';

import type { LedgerTransactionFormData } from './ledger-transaction-form';
import {
  ledgerTransactionFormDataToPayload,
  ledgerTransactionFormDefaultValues,
  ledgerTransactionFormResolver,
} from './ledger-transaction-form';

function makeFormData(
  overrides: Partial<LedgerTransactionFormData> = {},
): LedgerTransactionFormData {
  return {
    ...ledgerTransactionFormDefaultValues,
    description: 'Ghi nhận doanh thu',
    entries: [
      {
        accountCode: LedgerAccountCodeEnum.CASH,
        customerId: '',
        direction: PostingDirectionEnum.DEBIT,
        amount: 100_000,
      },
      {
        accountCode: LedgerAccountCodeEnum.REVENUE,
        customerId: '',
        direction: PostingDirectionEnum.CREDIT,
        amount: 100_000,
      },
    ],
    ...overrides,
  };
}

describe('ledgerTransactionFormResolver', () => {
  it('nhận bút toán có tổng nợ bằng tổng có', async () => {
    const formData = makeFormData();

    const result = await ledgerTransactionFormResolver(formData, undefined, {
      fields: {},
      shouldUseNativeValidation: false,
    });

    expect(result.errors).toEqual({});
  });

  it('từ chối bút toán lệch nợ có', async () => {
    const formData = makeFormData({
      entries: [
        {
          accountCode: LedgerAccountCodeEnum.CASH,
          customerId: '',
          direction: PostingDirectionEnum.DEBIT,
          amount: 100_000,
        },
        {
          accountCode: LedgerAccountCodeEnum.REVENUE,
          customerId: '',
          direction: PostingDirectionEnum.CREDIT,
          amount: 90_000,
        },
      ],
    });

    const result = await ledgerTransactionFormResolver(formData, undefined, {
      fields: {},
      shouldUseNativeValidation: false,
    });

    expect(result.errors).toHaveProperty('entries');
  });

  it('từ chối bút toán chỉ có một dòng', async () => {
    const formData = makeFormData({
      entries: [
        {
          accountCode: LedgerAccountCodeEnum.CASH,
          customerId: '',
          direction: PostingDirectionEnum.DEBIT,
          amount: 0,
        },
      ],
    });

    const result = await ledgerTransactionFormResolver(formData, undefined, {
      fields: {},
      shouldUseNativeValidation: false,
    });

    expect(result.errors).toHaveProperty('entries');
  });
});

describe('ledgerTransactionFormDataToPayload', () => {
  it('bỏ customer và mã đối chiếu rỗng khỏi payload', () => {
    const formData = makeFormData();

    const result = ledgerTransactionFormDataToPayload(formData);

    expect(result).toEqual({
      description: 'Ghi nhận doanh thu',
      currency: CurrencyEnum.VND,
      externalId: undefined,
      entries: [
        {
          accountCode: LedgerAccountCodeEnum.CASH,
          customerId: undefined,
          direction: PostingDirectionEnum.DEBIT,
          amount: 100_000,
        },
        {
          accountCode: LedgerAccountCodeEnum.REVENUE,
          customerId: undefined,
          direction: PostingDirectionEnum.CREDIT,
          amount: 100_000,
        },
      ],
    });
  });

  it('giữ customer khi tài khoản ghi theo khách', () => {
    const formData = makeFormData({
      externalId: 'ref_1',
      entries: [
        {
          accountCode: LedgerAccountCodeEnum.ACCOUNTS_RECEIVABLE,
          customerId: 'cus_1',
          direction: PostingDirectionEnum.DEBIT,
          amount: 100_000,
        },
        {
          accountCode: LedgerAccountCodeEnum.REVENUE,
          customerId: '',
          direction: PostingDirectionEnum.CREDIT,
          amount: 100_000,
        },
      ],
    });

    const result = ledgerTransactionFormDataToPayload(formData);

    expect(result.externalId).toBe('ref_1');
    expect(result.entries[0]?.customerId).toBe('cus_1');
  });
});
