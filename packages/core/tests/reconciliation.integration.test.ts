import { MILLISECONDS_PER_DAY } from '@constants/time';
import { ChargeOutcomeEnum, ChargeStatusEnum } from '@contracts/payments.types';
import { ReconciliationOutcomeEnum } from '@contracts/reporting.types';
import { CurrencyEnum } from '@utils/currency';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestContext } from './context';
import { makeOpenInvoice, settleInvoice, TEST_LIVEMODE } from './factories';

const BASE_AMOUNT = 500_000;
const UNPAGED_CHARGE_COUNT = 210;
const STRAY_CHARGE_AMOUNT = 1_000;

let fastify: FastifyInstance;

beforeAll(async () => {
  fastify = await buildTestContext();
});

afterAll(async () => {
  await fastify.close();
});

async function aggregateReport() {
  return fastify.reconciliationService.aggregateReconciliationReport(
    {
      windowStart: new Date(Date.now() - MILLISECONDS_PER_DAY).toISOString(),
      windowEnd: new Date(Date.now() + MILLISECONDS_PER_DAY).toISOString(),
    },
    TEST_LIVEMODE,
  );
}

describe('ReconciliationService.aggregateReconciliationReport', () => {
  it('matches a charge across the processor, the ledger and the invoice', async () => {
    const { invoiceId } = await makeOpenInvoice(fastify, { unitAmount: BASE_AMOUNT });
    const { chargeId } = await settleInvoice(fastify, invoiceId);

    const report = await aggregateReport();
    const exception = _.find(report.exceptions, { reference: `charge:${chargeId}` });

    expect(exception).toBeUndefined();
    expect(report.matched).toBeGreaterThan(0);
    expect(report.invoiceTotal).toBeGreaterThanOrEqual(BASE_AMOUNT);
  });

  it('flags a charge the invoice ledger never recorded a settlement for', async () => {
    const { invoiceId } = await makeOpenInvoice(fastify, { unitAmount: BASE_AMOUNT });
    const { chargeId } = await settleInvoice(fastify, invoiceId);

    await fastify.database.master.execute(
      `delete from invoice_payments where charge_id = '${chargeId}'`,
    );

    const report = await aggregateReport();
    const exception = _.find(report.exceptions, { reference: `charge:${chargeId}` });

    expect(exception?.outcome).toBe(ReconciliationOutcomeEnum.MISSING_IN_INVOICES);
    expect(exception?.invoiceAmount).toBe(0);
  });

  it('scans past the first page instead of silently dropping the rest', async () => {
    const { invoiceId, customerId } = await makeOpenInvoice(fastify, { unitAmount: BASE_AMOUNT });
    const { paymentIntentId } = await settleInvoice(fastify, invoiceId);
    const now = new Date();

    for (const index of _.range(UNPAGED_CHARGE_COUNT)) {
      await fastify.paymentIntentRepository.createCharge({
        id: generateGid(ObjectPrefixEnum.CHARGE),
        livemode: TEST_LIVEMODE,
        paymentIntentId,
        customerId,
        paymentMethodId: null,
        currency: CurrencyEnum.VND,
        amount: STRAY_CHARGE_AMOUNT,
        amountCaptured: STRAY_CHARGE_AMOUNT,
        amountRefunded: 0,
        captured: true,
        status: ChargeStatusEnum.SUCCEEDED,
        outcome: ChargeOutcomeEnum.APPROVED,
        balanceTransactionId: null,
        paymentMethodDetails: {},
        failureCode: null,
        declineCode: null,
        failureMessage: null,
        pspReference: null,
        metadata: {},
        createdAt: new Date(now.getTime() + index).toISOString(),
        updatedAt: now.toISOString(),
      });
    }

    const report = await aggregateReport();
    const missing = _.filter(report.exceptions, {
      outcome: ReconciliationOutcomeEnum.MISSING_IN_LEDGER,
    });

    expect(report.scanned).toBeGreaterThanOrEqual(UNPAGED_CHARGE_COUNT);
    expect(missing.length).toBeGreaterThanOrEqual(UNPAGED_CHARGE_COUNT);
  });
});
