import { loadEnv } from '@config/env.schema';
import { SystemClock } from '@utils/clock';
import { HostedUrlFactory } from '@utils/hosted-url';
import { RedisKeyFactory } from '@utils/redis-key-factory';
import fp from 'fastify-plugin';
import _ from 'lodash';

export interface ListenAddress {
  port: number;
  host: string;
}

export interface WorkflowSchedules {
  outboxRelayIntervalMs: number;
  outboxRelayBatchSize: number;
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
  webhookMaxAttempts: number;
  webhookBackoffMs: number;
  webhookTimeoutMs: number;
  webhookEndpointRateLimit: number;
  webhookEndpointRateWindowSeconds: number;
  apiRateLimit: number;
  apiRateWindowSeconds: number;
  portalRateLimit: number;
  portalRateWindowSeconds: number;
  invoiceReminderIntervalMs: number;
}

export const configPlugin = fp(async (fastify) => {
  const config = loadEnv(process.env);

  fastify.decorate('config', config);
  fastify.decorate('clock', new SystemClock());
  fastify.decorate('redisKeyFactory', new RedisKeyFactory(config.REDIS_KEY_PREFIX));
  fastify.decorate(
    'hostedUrlFactory',
    new HostedUrlFactory(config.PUBLIC_BASE_URL, config.HOSTED_URL_SECRET),
  );
  fastify.decorate('serverAddress', { port: config.API_PORT, host: config.API_HOST });
  fastify.decorate('workerAddress', { port: config.WORKER_PORT, host: config.API_HOST });
  fastify.decorate('workflowSchedules', {
    outboxRelayIntervalMs: config.OUTBOX_RELAY_INTERVAL_MS,
    outboxRelayBatchSize: config.OUTBOX_RELAY_BATCH_SIZE,
    ledgerIntegrityIntervalMs: config.LEDGER_INTEGRITY_INTERVAL_MS,
    ledgerIntegrityBatchSize: config.LEDGER_INTEGRITY_BATCH_SIZE,
    billingRunIntervalMs: config.BILLING_RUN_INTERVAL_MS,
    billingRunBatchSize: config.BILLING_RUN_BATCH_SIZE,
    billingRunShardCount: config.BILLING_RUN_SHARD_COUNT,
    billingRunJitterMs: config.BILLING_RUN_JITTER_MS,
    invoiceFinalizeDelayMs: config.INVOICE_FINALIZE_DELAY_MS,
    dunningIntervalMs: config.DUNNING_INTERVAL_MS,
    dunningBatchSize: config.DUNNING_BATCH_SIZE,
    dunningJitterMs: config.DUNNING_JITTER_MS,
    dunningRetryDelayDays: _.map(config.DUNNING_RETRY_DELAY_DAYS.split(','), Number),
    dunningInFlightTimeoutMs: config.DUNNING_IN_FLIGHT_TIMEOUT_MS,
    pspCallbackPollIntervalMs: config.PSP_CALLBACK_POLL_INTERVAL_MS,
    payoutSettlePollIntervalMs: config.PAYOUT_SETTLE_POLL_INTERVAL_MS,
    checkoutExpirePollIntervalMs: config.CHECKOUT_EXPIRE_POLL_INTERVAL_MS,
    webhookMaxAttempts: config.WEBHOOK_MAX_ATTEMPTS,
    webhookBackoffMs: config.WEBHOOK_BACKOFF_MS,
    webhookTimeoutMs: config.WEBHOOK_TIMEOUT_MS,
    webhookEndpointRateLimit: config.WEBHOOK_ENDPOINT_RATE_LIMIT,
    webhookEndpointRateWindowSeconds: config.WEBHOOK_ENDPOINT_RATE_WINDOW_SECONDS,
    apiRateLimit: config.API_RATE_LIMIT,
    apiRateWindowSeconds: config.API_RATE_WINDOW_SECONDS,
    portalRateLimit: config.PORTAL_RATE_LIMIT,
    portalRateWindowSeconds: config.PORTAL_RATE_WINDOW_SECONDS,
    invoiceReminderIntervalMs: config.INVOICE_REMINDER_INTERVAL_MS,
  });
});
