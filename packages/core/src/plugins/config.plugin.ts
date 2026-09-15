import { loadEnv } from '@config/env.schema';
import { SystemClock } from '@utils/clock';
import { RedisKeyFactory } from '@utils/redis-key-factory';
import fp from 'fastify-plugin';

export interface ListenAddress {
  port: number;
  host: string;
}

export interface WorkflowSchedules {
  outboxRelayIntervalMs: number;
  outboxRelayBatchSize: number;
  ledgerIntegrityIntervalMs: number;
  ledgerIntegrityBatchSize: number;
}

export const configPlugin = fp(async (fastify) => {
  const config = loadEnv(process.env);

  fastify.decorate('config', config);
  fastify.decorate('clock', new SystemClock());
  fastify.decorate('redisKeyFactory', new RedisKeyFactory(config.REDIS_KEY_PREFIX));
  fastify.decorate('serverAddress', { port: config.API_PORT, host: config.API_HOST });
  fastify.decorate('workerAddress', { port: config.WORKER_PORT, host: config.API_HOST });
  fastify.decorate('workflowSchedules', {
    outboxRelayIntervalMs: config.OUTBOX_RELAY_INTERVAL_MS,
    outboxRelayBatchSize: config.OUTBOX_RELAY_BATCH_SIZE,
    ledgerIntegrityIntervalMs: config.LEDGER_INTEGRITY_INTERVAL_MS,
    ledgerIntegrityBatchSize: config.LEDGER_INTEGRITY_BATCH_SIZE,
  });
});
