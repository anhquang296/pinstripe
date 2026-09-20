import { NodeEnvEnum } from '@pinstripe/core/config';
import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

import { CURRENT_PERIOD_ELAPSED_DAYS } from './demo-history';
import type { BackdatedInvoice } from './seed-demo.types';

const APPEND_ONLY_TABLES: readonly string[] = [
  'invoices',
  'invoice_line_items',
  'invoice_payments',
  'payment_intents',
  'charges',
  'ledger_transactions',
  'ledger_postings',
  'meter_events',
];

const INVOICE_TIMESTAMP_COLUMNS: readonly string[] = [
  'created_at',
  'updated_at',
  'finalized_at',
  'due_at',
  'paid_at',
  'sent_at',
  'next_attempt_at',
];

export async function shiftHistory(
  fastify: FastifyInstance,
  invoices: readonly BackdatedInvoice[],
): Promise<number> {
  if (fastify.config.NODE_ENV === NodeEnvEnum.PRODUCTION) {
    throw new Error('shiftHistory() refusing to rewrite timestamps in a production environment');
  }

  const shiftable = _.filter(invoices, (invoice) => {
    return invoice.shiftDays > 0;
  });

  if (_.isEmpty(shiftable)) {
    return 0;
  }

  await setAppendOnlyTriggers(fastify, false);

  try {
    for (const invoice of shiftable) {
      await shiftInvoice(fastify, invoice);
    }
  } finally {
    await setAppendOnlyTriggers(fastify, true);
  }

  await shiftCurrentPeriods(fastify);

  return shiftable.length;
}

async function shiftCurrentPeriods(fastify: FastifyInstance): Promise<void> {
  const interval = `${CURRENT_PERIOD_ELAPSED_DAYS} days`;

  await fastify.database.master.execute(
    sql`UPDATE subscriptions
        SET current_period_start = current_period_start - ${interval}::interval,
            current_period_end = current_period_end - ${interval}::interval,
            billing_cycle_anchor = billing_cycle_anchor - ${interval}::interval,
            created_at = created_at - ${interval}::interval,
            updated_at = updated_at - ${interval}::interval
        WHERE trial_end IS NULL`,
  );

  await fastify.database.master.execute(
    sql`UPDATE subscription_item_changes
        SET billed_from = billed_from - ${interval}::interval,
            created_at = created_at - ${interval}::interval
        WHERE subscription_id IN (SELECT id FROM subscriptions WHERE trial_end IS NULL)`,
  );
}

async function setAppendOnlyTriggers(fastify: FastifyInstance, isEnabled: boolean): Promise<void> {
  const action = isEnabled ? 'ENABLE' : 'DISABLE';

  for (const table of APPEND_ONLY_TABLES) {
    await fastify.database.master.execute(sql.raw(`ALTER TABLE ${table} ${action} TRIGGER USER`));
  }
}

async function shiftInvoice(fastify: FastifyInstance, invoice: BackdatedInvoice): Promise<void> {
  const { invoiceId, shiftDays, periodStart, periodEnd } = invoice;

  const interval = `${shiftDays} days`;
  const database = fastify.database.master;

  const invoiceAssignments = _.map(INVOICE_TIMESTAMP_COLUMNS, (column) => {
    return `${column} = ${column} - interval '${shiftDays} days'`;
  }).join(', ');

  await database.execute(
    sql`UPDATE invoices
        SET ${sql.raw(invoiceAssignments)},
            period_start = ${periodStart}::timestamptz,
            period_end = ${periodEnd}::timestamptz
        WHERE id = ${invoiceId}`,
  );

  await database.execute(
    sql`UPDATE invoice_line_items
        SET created_at = created_at - ${interval}::interval
        WHERE invoice_id = ${invoiceId}`,
  );

  await database.execute(
    sql`UPDATE invoice_payments
        SET created_at = created_at - ${interval}::interval,
            paid_at = paid_at - ${interval}::interval
        WHERE invoice_id = ${invoiceId}`,
  );

  await database.execute(
    sql`UPDATE payment_intents
        SET created_at = created_at - ${interval}::interval,
            updated_at = updated_at - ${interval}::interval
        WHERE invoice_id = ${invoiceId}`,
  );

  await database.execute(
    sql`UPDATE charges
        SET created_at = created_at - ${interval}::interval,
            updated_at = updated_at - ${interval}::interval
        WHERE payment_intent_id IN (
          SELECT id FROM payment_intents WHERE invoice_id = ${invoiceId}
        )`,
  );

  await database.execute(
    sql`UPDATE ledger_postings
        SET created_at = created_at - ${interval}::interval
        WHERE transaction_id IN (
          SELECT id FROM ledger_transactions WHERE ${buildLedgerPredicate(invoiceId)}
        )`,
  );

  await database.execute(
    sql`UPDATE ledger_transactions
        SET effective_at = effective_at - ${interval}::interval,
            created_at = created_at - ${interval}::interval
        WHERE ${buildLedgerPredicate(invoiceId)}`,
  );
}

function buildLedgerPredicate(invoiceId: string) {
  return sql`external_id LIKE ${`%${invoiceId}%`}
    OR external_id IN (
      SELECT 'charge:' || charges.id
      FROM charges
      JOIN payment_intents ON payment_intents.id = charges.payment_intent_id
      WHERE payment_intents.invoice_id = ${invoiceId}
    )`;
}
