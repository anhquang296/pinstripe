import {
  DisputeOutcomeEnum,
  DisputeReasonEnum,
  DisputeStatusEnum,
} from '@contracts/disputes.types';
import { EntitlementStatusEnum } from '@contracts/entitlements.types';
import { LedgerAccountCodeEnum } from '@contracts/ledger.types';
import { SubscriptionStatusEnum } from '@contracts/subscriptions.types';
import { CurrencyEnum } from '@utils/currency';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestContext } from './context';
import { makeOpenInvoice, settleInvoice } from './factories';

const BASE_AMOUNT = 500_000;
const DISPUTED_AMOUNT = 200_000;

let fastify: FastifyInstance;

beforeAll(async () => {
  fastify = await buildTestContext();
});

afterAll(async () => {
  await fastify.close();
});

interface DisputeFixture {
  disputeId: string;
  subscriptionId: string;
  productId: string;
  customerId: string;
}

async function readAccountBalance(code: LedgerAccountCodeEnum): Promise<number> {
  const account = await fastify.ledgerService.ensureAccount(code, CurrencyEnum.VND);

  return account.balance;
}

async function readEntitlementStatus(customerId: string, productId: string): Promise<string> {
  const { data } = await fastify.entitlementService.findEntitlements({ customerId, productId });
  const [entitlement] = data;

  return _.get(entitlement, 'status', EntitlementStatusEnum.REVOKED);
}

async function openDispute(): Promise<DisputeFixture> {
  const fixture = await makeOpenInvoice(fastify, { unitAmount: BASE_AMOUNT });
  const { chargeId, chargeReference } = await settleInvoice(fastify, fixture.invoiceId);

  fastify.psp.openDispute({
    reference: chargeReference,
    amount: DISPUTED_AMOUNT,
    reason: DisputeReasonEnum.FRAUDULENT,
  });

  await fastify.paymentService.drainProviderEvents();

  const disputes = await fastify.disputeService.findDisputes({ chargeId });
  const [dispute] = disputes.data;

  if (!dispute) {
    throw new Error('openDispute() the processor callback recorded no dispute');
  }

  return {
    disputeId: dispute.id,
    subscriptionId: fixture.subscriptionId,
    productId: fixture.productId,
    customerId: fixture.customerId,
  };
}

describe('DisputeService.handleDisputeOpened', () => {
  it('withholds the disputed amount and asks the subscription to stop trusting the payment', async () => {
    const heldBefore = await readAccountBalance(LedgerAccountCodeEnum.DISPUTES_HELD);
    const receivableBefore = await readAccountBalance(LedgerAccountCodeEnum.PSP_RECEIVABLE);
    const { disputeId, subscriptionId, customerId, productId } = await openDispute();

    const dispute = await fastify.disputeService.getDispute(disputeId);
    const subscription = await fastify.subscriptionService.getSubscription(subscriptionId);
    const entitlement = await readEntitlementStatus(customerId, productId);

    expect(dispute.status).toBe(DisputeStatusEnum.NEEDS_RESPONSE);
    expect(dispute.amount).toBe(DISPUTED_AMOUNT);
    expect(await readAccountBalance(LedgerAccountCodeEnum.DISPUTES_HELD)).toBe(
      heldBefore + DISPUTED_AMOUNT,
    );
    expect(await readAccountBalance(LedgerAccountCodeEnum.PSP_RECEIVABLE)).toBe(
      receivableBefore +
        BASE_AMOUNT -
        fastify.psp.calculateProcessingFee(BASE_AMOUNT) -
        DISPUTED_AMOUNT,
    );
    expect(subscription.status).toBe(SubscriptionStatusEnum.PAST_DUE);
    expect(entitlement).toBe(EntitlementStatusEnum.ACTIVE);
  });

  it('ignores a dispute callback it has already recorded', async () => {
    const { disputeId } = await openDispute();
    const dispute = await fastify.disputeService.getDispute(disputeId);

    await fastify.disputeService.handleDisputeOpened({
      pspReference: dispute.pspReference,
      chargeReference: 'ignored',
      amount: DISPUTED_AMOUNT,
      reason: DisputeReasonEnum.FRAUDULENT,
    });

    const disputes = await fastify.disputeService.findDisputes({ chargeId: dispute.chargeId });

    expect(disputes.data).toHaveLength(1);
  });
});

describe('DisputeService.submitDisputeEvidence', () => {
  it('moves the dispute under review once evidence is filed', async () => {
    const { disputeId } = await openDispute();

    const reviewed = await fastify.disputeService.submitDisputeEvidence(disputeId, {
      evidence: { uncategorizedText: 'Khách đã dùng dịch vụ đủ tháng' },
    });

    expect(reviewed.status).toBe(DisputeStatusEnum.UNDER_REVIEW);
    expect(reviewed.evidence.uncategorizedText).toBe('Khách đã dùng dịch vụ đủ tháng');
    expect(reviewed.evidenceSubmittedAt).not.toBeNull();
  });
});

describe('DisputeService.handleDisputeClosed', () => {
  it('nets the hold back out when the dispute is won', async () => {
    const heldBefore = await readAccountBalance(LedgerAccountCodeEnum.DISPUTES_HELD);
    const receivableBefore = await readAccountBalance(LedgerAccountCodeEnum.PSP_RECEIVABLE);
    const { disputeId, subscriptionId } = await openDispute();
    const dispute = await fastify.disputeService.getDispute(disputeId);

    fastify.psp.closeDispute(dispute.pspReference, DisputeOutcomeEnum.WON);

    await fastify.paymentService.drainProviderEvents();

    const closed = await fastify.disputeService.getDispute(disputeId);
    const subscription = await fastify.subscriptionService.getSubscription(subscriptionId);
    const balanceTransactions = await fastify.balanceTransactionRepository.findBalanceTransactions({
      sourceId: disputeId,
    });

    expect(closed.status).toBe(DisputeStatusEnum.WON);
    expect(closed.closedAt).not.toBeNull();
    expect(await readAccountBalance(LedgerAccountCodeEnum.DISPUTES_HELD)).toBe(heldBefore);
    expect(await readAccountBalance(LedgerAccountCodeEnum.PSP_RECEIVABLE)).toBe(
      receivableBefore + BASE_AMOUNT - fastify.psp.calculateProcessingFee(BASE_AMOUNT),
    );
    expect(_.sumBy(balanceTransactions, 'net')).toBe(0);
    expect(subscription.status).toBe(SubscriptionStatusEnum.ACTIVE);
  });

  it('writes the money off and blocks the entitlement when the dispute is lost', async () => {
    const heldBefore = await readAccountBalance(LedgerAccountCodeEnum.DISPUTES_HELD);
    const { disputeId, subscriptionId, customerId, productId } = await openDispute();
    const dispute = await fastify.disputeService.getDispute(disputeId);

    fastify.psp.closeDispute(dispute.pspReference, DisputeOutcomeEnum.LOST);

    await fastify.paymentService.drainProviderEvents();

    const closed = await fastify.disputeService.getDispute(disputeId);
    const subscription = await fastify.subscriptionService.getSubscription(subscriptionId);
    const entitlement = await readEntitlementStatus(customerId, productId);

    expect(closed.status).toBe(DisputeStatusEnum.LOST);
    expect(await readAccountBalance(LedgerAccountCodeEnum.DISPUTES_HELD)).toBe(heldBefore);
    expect(subscription.status).toBe(SubscriptionStatusEnum.UNPAID);
    expect(entitlement).toBe(EntitlementStatusEnum.BLOCKED);
  });
});
