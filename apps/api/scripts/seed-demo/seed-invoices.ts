import type { CollectionMethod, InvoiceResponse } from '@vxrerp/billing/contracts';
import { CollectionMethodEnum, PaymentMethodTypeEnum } from '@vxrerp/billing/contracts';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

import { DEMO_CARD_TOKEN } from './demo-catalog';
import { HISTORY_PERIOD_LENGTH_DAYS, HISTORY_SHIFT_DAYS } from './demo-history';
import { MILLISECONDS_PER_DAY } from './demo-history';
import type { DemoInvoiceLine, DemoOperator } from './demo-operators';
import { DemoOperatorKeyEnum } from './demo-operators';
import type { BackdatedInvoice, SeededCatalog, SeededOperator } from './seed-demo.types';

const HISTORY_DAYS_UNTIL_DUE = 7;
const CURRENT_DAYS_UNTIL_DUE = 0;
const OPEN_DAYS_UNTIL_DUE = 7;

interface SeededInvoices {
  backdated: BackdatedInvoice[];
  draftCount: number;
  paidCount: number;
}

export async function seedInvoices(
  fastify: FastifyInstance,
  catalog: SeededCatalog,
  operators: readonly SeededOperator[],
): Promise<SeededInvoices> {
  const backdated: BackdatedInvoice[] = [];

  let draftCount = 0;
  let paidCount = 0;

  for (const { operator, customerId } of operators) {
    if (_.isEmpty(operator.monthlyLines)) {
      continue;
    }

    const cardPaymentMethodId = await resolveCardPaymentMethodId(fastify, operator, customerId);

    for (const shiftDays of HISTORY_SHIFT_DAYS) {
      const isUnpaidOverdue =
        isOverdueOperator(operator) && shiftDays === _.last(HISTORY_SHIFT_DAYS);

      const issued = await issueInvoice(fastify, {
        customerId,
        collectionMethod: operator.collectionMethod,
        daysUntilDue: HISTORY_DAYS_UNTIL_DUE,
        taxRateId: catalog.taxRateId,
        lines: operator.monthlyLines,
        shiftDays,
      });

      backdated.push({
        invoiceId: issued.invoice.id,
        shiftDays,
        periodStart: issued.periodStart,
        periodEnd: issued.periodEnd,
      });

      if (isUnpaidOverdue) {
        continue;
      }

      await collectInvoice(fastify, issued.invoice, cardPaymentMethodId);

      paidCount += 1;
    }

    const currentInvoice = await issueCurrentInvoice(fastify, catalog, operator, customerId);

    if (currentInvoice.isDraft) {
      draftCount += 1;
    }
  }

  return { backdated, draftCount, paidCount };
}

function isOverdueOperator(operator: DemoOperator): boolean {
  return operator.key === DemoOperatorKeyEnum.HOANG_LONG;
}

async function resolveCardPaymentMethodId(
  fastify: FastifyInstance,
  operator: DemoOperator,
  customerId: string,
): Promise<string | null> {
  if (operator.collectionMethod !== CollectionMethodEnum.CHARGE_AUTOMATICALLY) {
    return null;
  }

  const paymentMethod = await fastify.paymentMethodService.createPaymentMethod({
    type: PaymentMethodTypeEnum.CARD,
    token: DEMO_CARD_TOKEN,
    customerId,
    billingDetails: { name: operator.name, email: operator.email },
  });

  const attached = await fastify.paymentMethodService.attachPaymentMethod(paymentMethod.id, {
    customerId,
    shouldBeDefault: true,
  });

  return attached.id;
}

interface IssueInvoiceOptions {
  customerId: string;
  collectionMethod: CollectionMethod;
  daysUntilDue: number;
  taxRateId: string;
  lines: readonly DemoInvoiceLine[];
  shiftDays: number;
}

interface DraftInvoice {
  invoice: InvoiceResponse;
  periodStart: string;
  periodEnd: string;
}

async function issueInvoice(
  fastify: FastifyInstance,
  options: IssueInvoiceOptions,
): Promise<DraftInvoice> {
  const draft = await createDraftInvoice(fastify, options);

  const invoice = await fastify.invoiceService.finalizeInvoice(draft.invoice.id);

  return { ...draft, invoice };
}

async function createDraftInvoice(
  fastify: FastifyInstance,
  options: IssueInvoiceOptions,
): Promise<DraftInvoice> {
  const { customerId, collectionMethod, daysUntilDue, taxRateId, lines, shiftDays } = options;

  const draft = await fastify.invoiceService.createInvoice({
    customerId,
    collectionMethod,
    autoAdvance: false,
    daysUntilDue,
    defaultTaxRates: [taxRateId],
  });

  const now = fastify.clock.now();
  const periodEnd = new Date(now.getTime() - shiftDays * MILLISECONDS_PER_DAY);

  const periodStart = new Date(
    periodEnd.getTime() - HISTORY_PERIOD_LENGTH_DAYS * MILLISECONDS_PER_DAY,
  );

  for (const line of lines) {
    await fastify.invoiceItemService.createInvoiceItem({
      customerId,
      invoiceId: draft.id,
      description: line.description,
      quantity: line.quantity,
      unitAmount: line.unitAmount,
      taxRates: [taxRateId],
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
    });
  }

  return {
    invoice: draft,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
  };
}

async function collectInvoice(
  fastify: FastifyInstance,
  invoice: InvoiceResponse,
  cardPaymentMethodId: string | null,
): Promise<void> {
  if (!cardPaymentMethodId) {
    await fastify.invoiceService.payInvoice(invoice.id, {});

    return;
  }

  const paymentIntent = await fastify.paymentService.createPaymentIntent({
    invoiceId: invoice.id,
    paymentMethodId: cardPaymentMethodId,
  });

  await fastify.paymentService.confirmPaymentIntent(paymentIntent.id, {
    paymentMethodId: cardPaymentMethodId,
  });

  await fastify.paymentService.drainProviderEvents();
}

async function issueCurrentInvoice(
  fastify: FastifyInstance,
  catalog: SeededCatalog,
  operator: DemoOperator,
  customerId: string,
): Promise<{ isDraft: boolean }> {
  const isOpenNow = operator.collectionMethod === CollectionMethodEnum.SEND_INVOICE;

  const options: IssueInvoiceOptions = {
    customerId,
    collectionMethod: operator.collectionMethod,
    daysUntilDue: isOpenNow ? OPEN_DAYS_UNTIL_DUE : CURRENT_DAYS_UNTIL_DUE,
    taxRateId: catalog.taxRateId,
    lines: operator.monthlyLines,
    shiftDays: 0,
  };

  if (isOpenNow) {
    await issueInvoice(fastify, options);

    return { isDraft: false };
  }

  await createDraftInvoice(fastify, options);

  return { isDraft: true };
}
