import type { MockVexereSource } from '@clients/mock-vexere.client';
import { MockVexereClient, MockVexereSourceEnum } from '@clients/mock-vexere.client';
import { MILLISECONDS_PER_DAY } from '@constants/time';
import { CollectionAttemptStatusEnum } from '@contracts/collection-attempts.types';
import { InvoiceStatusEnum } from '@contracts/invoices.types';
import { LedgerAccountCodeEnum } from '@contracts/ledger.types';
import type { CollectionMethod } from '@contracts/subscriptions.types';
import { CollectionMethodEnum, SubscriptionStatusEnum } from '@contracts/subscriptions.types';
import { BadRequestError } from '@errors/app.error';
import { CurrencyEnum } from '@utils/currency';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestContext } from './context';
import { makeOpenInvoice, makeSubscription } from './factories';

const CLOCK_START = new Date(Date.now() - 2 * MILLISECONDS_PER_DAY).toISOString();
const BASE_AMOUNT = 500_000;
const SHARD_JOB = { shardIndex: 0, shardCount: 1 };

let fastify: FastifyInstance;

beforeAll(async () => {
  fastify = await buildTestContext();
});

afterAll(async () => {
  await fastify.close();
});

function readMockVexere(): MockVexereClient {
  const provider = fastify.operatorCollectionProvider;

  if (provider instanceof MockVexereClient) {
    return provider;
  }

  throw new Error('test context is not wired to the mock Vexere client');
}

async function makeOperatorInvoice(collectionMethod: CollectionMethod) {
  const vexereOperatorId = `op_${generateGid(ObjectPrefixEnum.CUSTOMER)}`;
  const fixture = await makeOpenInvoice(fastify, {
    unitAmount: BASE_AMOUNT,
    frozenTime: CLOCK_START,
    collectionMethod,
    vexereOperatorId,
  });

  return { ...fixture, vexereOperatorId };
}

async function readInvoiceRow(invoiceId: string) {
  const invoice = await fastify.invoiceRepository.findInvoice(invoiceId);

  if (invoice) {
    return invoice;
  }

  throw new Error(`test fixture lost invoice ${invoiceId}`);
}

async function readDueAt(invoiceId: string): Promise<Date> {
  const { dueAt } = await readInvoiceRow(invoiceId);

  if (dueAt) {
    return new Date(dueAt);
  }

  throw new Error(`test fixture left invoice ${invoiceId} without a due date`);
}

async function readNextAttemptAt(invoiceId: string): Promise<Date> {
  const { nextAttemptAt } = await readInvoiceRow(invoiceId);

  if (nextAttemptAt) {
    return new Date(nextAttemptAt);
  }

  throw new Error(`test fixture left invoice ${invoiceId} without a next attempt`);
}

async function runShard(runAt: Date) {
  return fastify.dunningService.runDunningShard({ ...SHARD_JOB, runAt: runAt.toISOString() });
}

async function readAccountBalance(code: LedgerAccountCodeEnum): Promise<number> {
  const account = await fastify.ledgerService.ensureAccount(code, CurrencyEnum.VND);

  return account.balance;
}

function fundOperator(source: MockVexereSource, operatorId: string, amount: number): void {
  readMockVexere().fundOperator(source, operatorId, amount);
}

describe('InvoiceService.finalizeInvoice operator collection', () => {
  it.each([CollectionMethodEnum.OFFSET_TICKET, CollectionMethodEnum.DEBIT_WALLET])(
    'schedules a first collection attempt at the due date for %s',
    async (collectionMethod) => {
      const { invoiceId } = await makeOperatorInvoice(collectionMethod);

      const invoice = await readInvoiceRow(invoiceId);

      expect(invoice.collectionMethod).toBe(collectionMethod);
      expect(invoice.nextAttemptAt).toEqual(invoice.dueAt);
    },
  );
});

describe('DunningService.runDunningShard operator collection', () => {
  it('settles an offset_ticket invoice in full from ticket sales and posts to the ticket clearing account', async () => {
    const { invoiceId, subscriptionId, vexereOperatorId } = await makeOperatorInvoice(
      CollectionMethodEnum.OFFSET_TICKET,
    );
    const dueAt = await readDueAt(invoiceId);
    fundOperator(MockVexereSourceEnum.TICKET_SALES, vexereOperatorId, BASE_AMOUNT * 2);
    const clearingBefore = await readAccountBalance(LedgerAccountCodeEnum.TICKET_OFFSET_CLEARING);

    await runShard(new Date(dueAt.getTime() + MILLISECONDS_PER_DAY));

    const invoice = await readInvoiceRow(invoiceId);
    const [collectionAttempt] = await fastify.collectionAttemptRepository.findCollectionAttempts({
      invoiceId,
    });
    const subscription = await fastify.subscriptionRepository.getSubscription(subscriptionId);

    expect(invoice.status).toBe(InvoiceStatusEnum.PAID);
    expect(invoice.nextAttemptAt).toBeNull();
    expect(_.get(collectionAttempt, 'status')).toBe(CollectionAttemptStatusEnum.SUCCEEDED);
    expect(_.get(collectionAttempt, 'appliedAmount')).toBe(BASE_AMOUNT);
    expect(await readAccountBalance(LedgerAccountCodeEnum.TICKET_OFFSET_CLEARING)).toBe(
      clearingBefore + BASE_AMOUNT,
    );
    expect(
      readMockVexere().resolveOperatorBalance(MockVexereSourceEnum.TICKET_SALES, vexereOperatorId),
    ).toBe(BASE_AMOUNT);
    expect(subscription.status).toBe(SubscriptionStatusEnum.ACTIVE);
    expect(subscription.chargedThroughDate).toBe(invoice.periodEnd);
  });

  it('takes what the wallet holds, leaves the rest owed and schedules a retry', async () => {
    const { invoiceId, subscriptionId, vexereOperatorId } = await makeOperatorInvoice(
      CollectionMethodEnum.DEBIT_WALLET,
    );
    const dueAt = await readDueAt(invoiceId);
    const runAt = new Date(dueAt.getTime() + MILLISECONDS_PER_DAY);
    const walletAmount = BASE_AMOUNT / 5;
    fundOperator(MockVexereSourceEnum.WALLET, vexereOperatorId, walletAmount);
    const clearingBefore = await readAccountBalance(LedgerAccountCodeEnum.OPERATOR_WALLET_CLEARING);

    await runShard(runAt);

    const invoice = await readInvoiceRow(invoiceId);
    const owed = await fastify.invoiceService.getInvoice(invoiceId);
    const subscription = await fastify.subscriptionRepository.getSubscription(subscriptionId);

    expect(invoice.status).toBe(InvoiceStatusEnum.OPEN);
    expect(invoice.amountPaid).toBe(walletAmount);
    expect(owed.amountRemaining).toBe(BASE_AMOUNT - walletAmount);
    expect(invoice.attemptCount).toBe(1);
    expect(invoice.nextAttemptAt).toBe(
      new Date(runAt.getTime() + MILLISECONDS_PER_DAY).toISOString(),
    );
    expect(await readAccountBalance(LedgerAccountCodeEnum.OPERATOR_WALLET_CLEARING)).toBe(
      clearingBefore + walletAmount,
    );
    expect(subscription.status).toBe(SubscriptionStatusEnum.INCOMPLETE);
  });

  it('collects the remainder on the retry and recovers the subscription', async () => {
    const { invoiceId, subscriptionId, vexereOperatorId } = await makeOperatorInvoice(
      CollectionMethodEnum.DEBIT_WALLET,
    );
    const dueAt = await readDueAt(invoiceId);
    fundOperator(MockVexereSourceEnum.WALLET, vexereOperatorId, BASE_AMOUNT / 2);
    await runShard(new Date(dueAt.getTime() + MILLISECONDS_PER_DAY));
    fundOperator(MockVexereSourceEnum.WALLET, vexereOperatorId, BASE_AMOUNT);
    const nextAttemptAt = await readNextAttemptAt(invoiceId);

    await runShard(nextAttemptAt);

    const invoice = await readInvoiceRow(invoiceId);
    const collectionAttempts = await fastify.collectionAttemptRepository.findCollectionAttempts({
      invoiceId,
    });
    const subscription = await fastify.subscriptionRepository.getSubscription(subscriptionId);

    expect(invoice.status).toBe(InvoiceStatusEnum.PAID);
    expect(invoice.amountPaid).toBe(BASE_AMOUNT);
    expect(_.sumBy(collectionAttempts, 'appliedAmount')).toBe(BASE_AMOUNT);
    expect(subscription.status).toBe(SubscriptionStatusEnum.ACTIVE);
  });

  it('marks the invoice uncollectible once the retry schedule runs out with nothing to take', async () => {
    const { invoiceId, subscriptionId } = await makeOperatorInvoice(
      CollectionMethodEnum.OFFSET_TICKET,
    );
    const dueAt = await readDueAt(invoiceId);
    const retryCount = fastify.workflowSchedules.dunningRetryDelayDays.length;

    let runAt = new Date(dueAt.getTime() + MILLISECONDS_PER_DAY);

    for (const _attempt of _.range(retryCount + 1)) {
      await runShard(runAt);

      const { nextAttemptAt } = await readInvoiceRow(invoiceId);
      const retryAt = nextAttemptAt ? new Date(nextAttemptAt) : runAt;

      runAt = new Date(retryAt.getTime() + MILLISECONDS_PER_DAY);
    }

    const invoice = await readInvoiceRow(invoiceId);
    const collectionAttempts = await fastify.collectionAttemptRepository.findCollectionAttempts({
      invoiceId,
    });
    const subscription = await fastify.subscriptionRepository.getSubscription(subscriptionId);

    expect(invoice.status).toBe(InvoiceStatusEnum.UNCOLLECTIBLE);
    expect(invoice.attemptCount).toBe(retryCount + 1);
    expect(_.every(collectionAttempts, { status: CollectionAttemptStatusEnum.FAILED })).toBe(true);
    expect(subscription.status).toBe(SubscriptionStatusEnum.INCOMPLETE);
  });

  it('replays a pending attempt with the same idempotency key instead of debiting twice', async () => {
    const { invoiceId, vexereOperatorId } = await makeOperatorInvoice(
      CollectionMethodEnum.DEBIT_WALLET,
    );
    const dueAt = await readDueAt(invoiceId);
    const createdAt = dueAt.toISOString();
    const collectionAttemptId = generateGid(ObjectPrefixEnum.COLLECTION_ATTEMPT);
    fundOperator(MockVexereSourceEnum.WALLET, vexereOperatorId, BASE_AMOUNT);
    await fastify.collectionAttemptRepository.createCollectionAttempt({
      id: collectionAttemptId,
      invoiceId,
      collectionMethod: CollectionMethodEnum.DEBIT_WALLET,
      requestedAmount: BASE_AMOUNT,
      status: CollectionAttemptStatusEnum.PENDING,
      createdAt,
      updatedAt: createdAt,
    });
    await readMockVexere().debitWallet({
      operatorId: vexereOperatorId,
      amount: BASE_AMOUNT,
      currency: CurrencyEnum.VND,
      idempotencyKey: collectionAttemptId,
      invoiceId,
      invoiceNumber: null,
    });

    await runShard(new Date(dueAt.getTime() + MILLISECONDS_PER_DAY));

    const invoice = await readInvoiceRow(invoiceId);
    const collectionAttempts = await fastify.collectionAttemptRepository.findCollectionAttempts({
      invoiceId,
    });

    expect(invoice.status).toBe(InvoiceStatusEnum.PAID);
    expect(collectionAttempts).toHaveLength(1);
    expect(
      readMockVexere().resolveOperatorBalance(MockVexereSourceEnum.WALLET, vexereOperatorId),
    ).toBe(0);
  });
});

describe('SubscriptionService.createSubscription operator collection', () => {
  it('throws BadRequestError when the customer has no Vexere operator', async () => {
    await expect(
      makeSubscription(fastify, {
        frozenTime: CLOCK_START,
        collectionMethod: CollectionMethodEnum.OFFSET_TICKET,
      }),
    ).rejects.toThrow(BadRequestError);
  });
});
