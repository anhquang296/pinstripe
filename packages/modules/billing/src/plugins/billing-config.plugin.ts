import { loadBillingEnv } from '@config/billing-env.schema';
import { HostedUrlFactory } from '@utils/hosted-url';
import fp from 'fastify-plugin';
import _ from 'lodash';

export interface BillingSchedules {
  ledgerIntegrityIntervalMs: number;
  ledgerIntegrityBatchSize: number;
  billingRunIntervalMs: number;
  billingRunBatchSize: number;
  billingRunShardCount: number;
  billingRunJitterMs: number;
  invoiceFinalizeDelayMs: number;
  dunningIntervalMs: number;
  dunningBatchSize: number;
  dunningJitterMs: number;
  dunningRetryDelayDays: number[];
  dunningInFlightTimeoutMs: number;
  pspCallbackPollIntervalMs: number;
  payoutSettlePollIntervalMs: number;
  checkoutExpirePollIntervalMs: number;
  portalRateLimit: number;
  portalRateWindowSeconds: number;
  invoiceReminderIntervalMs: number;
}

export const billingConfigPlugin = fp(async (fastify) => {
  const billingConfig = loadBillingEnv(process.env);

  fastify.decorate('billingConfig', billingConfig);
  fastify.decorate(
    'hostedUrlFactory',
    new HostedUrlFactory(billingConfig.PUBLIC_BASE_URL, billingConfig.HOSTED_URL_SECRET),
  );
  fastify.decorate('billingSchedules', {
    ledgerIntegrityIntervalMs: billingConfig.LEDGER_INTEGRITY_INTERVAL_MS,
    ledgerIntegrityBatchSize: billingConfig.LEDGER_INTEGRITY_BATCH_SIZE,
    billingRunIntervalMs: billingConfig.BILLING_RUN_INTERVAL_MS,
    billingRunBatchSize: billingConfig.BILLING_RUN_BATCH_SIZE,
    billingRunShardCount: billingConfig.BILLING_RUN_SHARD_COUNT,
    billingRunJitterMs: billingConfig.BILLING_RUN_JITTER_MS,
    invoiceFinalizeDelayMs: billingConfig.INVOICE_FINALIZE_DELAY_MS,
    dunningIntervalMs: billingConfig.DUNNING_INTERVAL_MS,
    dunningBatchSize: billingConfig.DUNNING_BATCH_SIZE,
    dunningJitterMs: billingConfig.DUNNING_JITTER_MS,
    dunningRetryDelayDays: _.map(billingConfig.DUNNING_RETRY_DELAY_DAYS.split(','), Number),
    dunningInFlightTimeoutMs: billingConfig.DUNNING_IN_FLIGHT_TIMEOUT_MS,
    pspCallbackPollIntervalMs: billingConfig.PSP_CALLBACK_POLL_INTERVAL_MS,
    payoutSettlePollIntervalMs: billingConfig.PAYOUT_SETTLE_POLL_INTERVAL_MS,
    checkoutExpirePollIntervalMs: billingConfig.CHECKOUT_EXPIRE_POLL_INTERVAL_MS,
    portalRateLimit: billingConfig.PORTAL_RATE_LIMIT,
    portalRateWindowSeconds: billingConfig.PORTAL_RATE_WINDOW_SECONDS,
    invoiceReminderIntervalMs: billingConfig.INVOICE_REMINDER_INTERVAL_MS,
  });
});
