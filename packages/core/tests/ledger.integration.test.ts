import { LedgerAccountCodeEnum, PostingDirectionEnum } from '@contracts/ledger.types';
import { BadRequestError, ConflictError } from '@errors/app.error';
import { CurrencyEnum } from '@utils/currency';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestContext } from './context';

const RANDOM_TRANSACTION_COUNT = 1000;
const WRITE_CONCURRENCY = 25;
const MAX_RANDOM_AMOUNT = 5_000_000;

let fastify: FastifyInstance;

beforeAll(async () => {
  fastify = await buildTestContext();
});

afterAll(async () => {
  await fastify.close();
});

function buildCustomerId(): string {
  return generateGid(ObjectPrefixEnum.CUSTOMER);
}

async function postRevenueTransaction(customerId: string, amount: number): Promise<string> {
  const transaction = await fastify.ledgerService.postTransaction(
    {
      description: 'Invoice finalized',
      currency: CurrencyEnum.VND,
      entries: [
        {
          accountCode: LedgerAccountCodeEnum.ACCOUNTS_RECEIVABLE,
          customerId,
          direction: PostingDirectionEnum.DEBIT,
          amount,
        },
        {
          accountCode: LedgerAccountCodeEnum.REVENUE,
          direction: PostingDirectionEnum.CREDIT,
          amount,
        },
      ],
    },
    false,
  );

  return transaction.id;
}

describe('LedgerService.postTransaction', () => {
  it('rejects a transaction whose debits do not equal its credits', async () => {
    const act = fastify.ledgerService.postTransaction(
      {
        description: 'Unbalanced',
        currency: CurrencyEnum.VND,
        entries: [
          {
            accountCode: LedgerAccountCodeEnum.CASH,
            direction: PostingDirectionEnum.DEBIT,
            amount: 100,
          },
          {
            accountCode: LedgerAccountCodeEnum.REVENUE,
            direction: PostingDirectionEnum.CREDIT,
            amount: 99,
          },
        ],
      },
      false,
    );

    await expect(act).rejects.toThrowError(BadRequestError);
  });

  it('rejects a second transaction posted under the same external id', async () => {
    const externalId = `invoice:${generateGid(ObjectPrefixEnum.INVOICE)}:finalize`;
    const entries = [
      {
        accountCode: LedgerAccountCodeEnum.CASH,
        direction: PostingDirectionEnum.DEBIT,
        amount: 500,
      },
      {
        accountCode: LedgerAccountCodeEnum.REVENUE,
        direction: PostingDirectionEnum.CREDIT,
        amount: 500,
      },
    ];
    await fastify.ledgerService.postTransaction(
      {
        description: 'First write',
        currency: CurrencyEnum.VND,
        externalId,
        entries,
      },
      false,
    );

    const act = fastify.ledgerService.postTransaction(
      {
        description: 'Retry of the same write',
        currency: CurrencyEnum.VND,
        externalId,
        entries,
      },
      false,
    );

    await expect(act).rejects.toThrowError(ConflictError);
  });

  it('keeps every posting summing to zero across a thousand random transactions', async () => {
    const customerId = buildCustomerId();
    const pending = Array.from({ length: RANDOM_TRANSACTION_COUNT }, () => {
      return Math.floor(Math.random() * MAX_RANDOM_AMOUNT) + 1;
    });

    for (let cursor = 0; cursor < pending.length; cursor += WRITE_CONCURRENCY) {
      await Promise.all(
        pending.slice(cursor, cursor + WRITE_CONCURRENCY).map((amount) => {
          return postRevenueTransaction(customerId, amount);
        }),
      );
    }

    const imbalanced = await fastify.ledgerService.findImbalancedTransactions(10);
    const [receivable] = await fastify.ledgerAccountRepository.findLedgerAccounts(
      { customerId: customerId, code: LedgerAccountCodeEnum.ACCOUNTS_RECEIVABLE },
      1,
    );

    expect(imbalanced).toEqual([]);
    expect(receivable?.balance).toBe(
      pending.reduce((total, amount) => {
        return total + amount;
      }, 0),
    );
  });
});

describe('ledger postings', () => {
  it('cannot be updated, because a correction is a new transaction', async () => {
    const customerId = buildCustomerId();
    const transactionId = await postRevenueTransaction(customerId, 10_000);

    const act = fastify.database.master.execute(
      sql`update ledger_postings set amount = 1 where transaction_id = ${transactionId}`,
    );

    await expect(act).rejects.toThrowError(/append-only/);
  });

  it('cannot be deleted either', async () => {
    const customerId = buildCustomerId();
    const transactionId = await postRevenueTransaction(customerId, 10_000);

    const act = fastify.database.master.execute(
      sql`delete from ledger_postings where transaction_id = ${transactionId}`,
    );

    await expect(act).rejects.toThrowError(/append-only/);
  });
});

describe('LedgerService.reverseTransaction', () => {
  it('returns the account balance to where it was before the original transaction', async () => {
    const customerId = buildCustomerId();
    const transactionId = await postRevenueTransaction(customerId, 250_000);
    const [before] = await fastify.ledgerAccountRepository.findLedgerAccounts(
      { customerId: customerId, code: LedgerAccountCodeEnum.ACCOUNTS_RECEIVABLE },
      1,
    );

    await fastify.ledgerService.reverseTransaction(transactionId, { reason: 'Issued in error' });
    const [after] = await fastify.ledgerAccountRepository.findLedgerAccounts(
      { customerId: customerId, code: LedgerAccountCodeEnum.ACCOUNTS_RECEIVABLE },
      1,
    );
    const original = await fastify.ledgerService.getTransaction(transactionId, false);

    expect(before?.balance).toBe(250_000);
    expect(after?.balance).toBe(0);
    expect(original.reversedByTransactionId).not.toBeNull();
  });

  it('refuses to reverse the same transaction twice', async () => {
    const customerId = buildCustomerId();
    const transactionId = await postRevenueTransaction(customerId, 90_000);
    await fastify.ledgerService.reverseTransaction(transactionId, { reason: 'First reversal' });

    const act = fastify.ledgerService.reverseTransaction(transactionId, { reason: 'Second' });

    await expect(act).rejects.toThrowError(ConflictError);
  });
});

describe('LedgerService.ensureAccount', () => {
  it('returns the same account when asked twice', async () => {
    const customerId = buildCustomerId();

    const first = await fastify.ledgerService.ensureAccount(
      LedgerAccountCodeEnum.CUSTOMER_CREDIT_BALANCE,
      CurrencyEnum.VND,
      false,
      customerId,
    );
    const second = await fastify.ledgerService.ensureAccount(
      LedgerAccountCodeEnum.CUSTOMER_CREDIT_BALANCE,
      CurrencyEnum.VND,
      false,
      customerId,
    );

    expect(second.id).toBe(first.id);
  });

  it('rejects a per customer account asked for without a customer', async () => {
    const act = fastify.ledgerService.ensureAccount(
      LedgerAccountCodeEnum.ACCOUNTS_RECEIVABLE,
      CurrencyEnum.VND,
      false,
    );

    await expect(act).rejects.toThrowError(BadRequestError);
  });
});
