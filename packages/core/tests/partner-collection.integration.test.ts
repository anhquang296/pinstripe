import type { MockVexereSource } from '@clients/mock-vexere.client';
import { MockVexereClient, MockVexereSourceEnum } from '@clients/mock-vexere.client';
import { MILLISECONDS_PER_DAY } from '@constants/time';
import { CollectionAttemptStatusEnum } from '@contracts/collection-attempts.types';
import { PartnerPlatformEnum } from '@contracts/customers.types';
import { InvoiceStatusEnum } from '@contracts/invoices.types';
import { LedgerAccountCodeEnum } from '@contracts/ledger.types';
import type { CollectionMethod } from '@contracts/subscriptions.types';
import { CollectionMethodEnum, SubscriptionStatusEnum } from '@contracts/subscriptions.types';
import { BadRequestError, ConflictError } from '@errors/app.error';
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
  const provider = fastify.partnerCollectionProviders[PartnerPlatformEnum.VEXERE];

  if (provider instanceof MockVexereClient) {
    return provider;
  }

  throw new Error('test context is not wired to the mock Vexere client');
}

function buildPartnerAccountId(): string {
  return `acct_${generateGid(ObjectPrefixEnum.CUSTOMER)}`;
}

async function makePartnerInvoice(collectionMethod: CollectionMethod) {
  const partnerAccountId = buildPartnerAccountId();

  const fixture = await makeOpenInvoice(fastify, {
    unitAmount: BASE_AMOUNT,
    frozenTime: CLOCK_START,
    collectionMethod,
    partnerPlatform: PartnerPlatformEnum.VEXERE,
    partnerAccountId,
  });

  return { ...fixture, partnerAccountId };
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

function fundAccount(source: MockVexereSource, partnerAccountId: string, amount: number): void {
  readMockVexere().fundAccount(source, partnerAccountId, amount);
}

describe('InvoiceService.finalizeInvoice partner collection', () => {
  it.each([CollectionMethodEnum.OFFSET_TICKET, CollectionMethodEnum.DEBIT_WALLET])(
    'schedules a first collection attempt at the due date for %s',
    async (collectionMethod) => {
      const { invoiceId } = await makePartnerInvoice(collectionMethod);

      const invoice = await readInvoiceRow(invoiceId);

      expect(invoice.collectionMethod).toBe(collectionMethod);
      expect(invoice.nextAttemptAt).toEqual(invoice.dueAt);
    },
  );
});

describe('DunningService.runDunningShard partner collection', () => {
  it('settles an offset_ticket invoice in full from ticket sales and posts to the ticket clearing account', async () => {
    const { invoiceId, subscriptionId, partnerAccountId } = await makePartnerInvoice(
      CollectionMethodEnum.OFFSET_TICKET,
    );

    const dueAt = await readDueAt(invoiceId);

    fundAccount(MockVexereSourceEnum.TICKET_SALES, partnerAccountId, BASE_AMOUNT * 2);
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
      readMockVexere().resolveAccountBalance(MockVexereSourceEnum.TICKET_SALES, partnerAccountId),
    ).toBe(BASE_AMOUNT);
    expect(subscription.status).toBe(SubscriptionStatusEnum.ACTIVE);
    expect(subscription.chargedThroughDate).toBe(invoice.periodEnd);
  });

  it('takes what the wallet holds, leaves the rest owed and schedules a retry', async () => {
    const { invoiceId, subscriptionId, partnerAccountId } = await makePartnerInvoice(
      CollectionMethodEnum.DEBIT_WALLET,
    );

    const dueAt = await readDueAt(invoiceId);
    const runAt = new Date(dueAt.getTime() + MILLISECONDS_PER_DAY);
    const walletAmount = BASE_AMOUNT / 5;

    fundAccount(MockVexereSourceEnum.WALLET, partnerAccountId, walletAmount);
    const clearingBefore = await readAccountBalance(LedgerAccountCodeEnum.PARTNER_WALLET_CLEARING);

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
    expect(await readAccountBalance(LedgerAccountCodeEnum.PARTNER_WALLET_CLEARING)).toBe(
      clearingBefore + walletAmount,
    );
    expect(subscription.status).toBe(SubscriptionStatusEnum.INCOMPLETE);
  });

  it('collects the remainder on the retry and recovers the subscription', async () => {
    const { invoiceId, subscriptionId, partnerAccountId } = await makePartnerInvoice(
      CollectionMethodEnum.DEBIT_WALLET,
    );

    const dueAt = await readDueAt(invoiceId);

    fundAccount(MockVexereSourceEnum.WALLET, partnerAccountId, BASE_AMOUNT / 2);
    await runShard(new Date(dueAt.getTime() + MILLISECONDS_PER_DAY));
    fundAccount(MockVexereSourceEnum.WALLET, partnerAccountId, BASE_AMOUNT);
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
    const { invoiceId, subscriptionId } = await makePartnerInvoice(
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
    const { invoiceId, partnerAccountId } = await makePartnerInvoice(
      CollectionMethodEnum.DEBIT_WALLET,
    );

    const dueAt = await readDueAt(invoiceId);
    const createdAt = dueAt.toISOString();
    const collectionAttemptId = generateGid(ObjectPrefixEnum.COLLECTION_ATTEMPT);

    fundAccount(MockVexereSourceEnum.WALLET, partnerAccountId, BASE_AMOUNT);
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
      partnerAccountId,
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
      readMockVexere().resolveAccountBalance(MockVexereSourceEnum.WALLET, partnerAccountId),
    ).toBe(0);
  });
});

describe('SubscriptionService.createSubscription partner collection', () => {
  it('throws BadRequestError when the customer has no partner account', async () => {
    await expect(
      makeSubscription(fastify, {
        frozenTime: CLOCK_START,
        collectionMethod: CollectionMethodEnum.OFFSET_TICKET,
      }),
    ).rejects.toThrow(BadRequestError);
  });
});

describe('CustomerService partner account mapping', () => {
  it('throws BadRequestError when partnerAccountId is sent without partnerPlatform', async () => {
    await expect(
      fastify.customerService.createCustomer({
        currency: CurrencyEnum.VND,
        partnerAccountId: buildPartnerAccountId(),
      }),
    ).rejects.toThrow(BadRequestError);
  });

  it('throws BadRequestError when an update clears only one half of the mapping', async () => {
    const customer = await fastify.customerService.createCustomer({
      currency: CurrencyEnum.VND,
      partnerPlatform: PartnerPlatformEnum.VEXERE,
      partnerAccountId: buildPartnerAccountId(),
    });

    await expect(
      fastify.customerService.updateCustomer(customer.id, { partnerAccountId: null }),
    ).rejects.toThrow(BadRequestError);
  });

  it('throws ConflictError when the partner account is already mapped to another customer', async () => {
    const partnerAccountId = buildPartnerAccountId();

    await fastify.customerService.createCustomer({
      currency: CurrencyEnum.VND,
      partnerPlatform: PartnerPlatformEnum.VEXERE,
      partnerAccountId,
    });

    await expect(
      fastify.customerService.createCustomer({
        currency: CurrencyEnum.VND,
        partnerPlatform: PartnerPlatformEnum.VEXERE,
        partnerAccountId,
      }),
    ).rejects.toThrow(ConflictError);
  });
});
