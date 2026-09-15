import { Worker } from 'bullmq';
import type { Job } from 'bullmq';
import { Redis } from 'ioredis';
import type { FastifyInstance } from 'fastify';
import {
  buildLedgerIntegrityCheckJob,
  LEDGER_INTEGRITY_CHECK_JOB,
  LEDGER_QUEUE,
  QueueNameEnum,
} from '@pinstripe/core/queues';
import type { LedgerIntegrityCheckJob } from '@pinstripe/core/queues';
import { LedgerIntegrityCheckProcessor } from '@workflows/processors/ledger-integrity-check.processor';
import type { Workflow } from '@workflows/workflow';

const INTEGRITY_SCHEDULER_ID = 'ledger-integrity-scheduler';

export class LedgerWorkflow implements Workflow {
  private readonly worker: Worker<LedgerIntegrityCheckJob>;
  private readonly connection: Redis;
  private readonly processor: LedgerIntegrityCheckProcessor;

  constructor(private readonly fastify: FastifyInstance) {
    const { REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_KEY_PREFIX } = fastify.config;

    this.processor = new LedgerIntegrityCheckProcessor(fastify);
    this.connection = new Redis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      password: REDIS_PASSWORD,
      maxRetriesPerRequest: null,
    });
    this.worker = new Worker<LedgerIntegrityCheckJob>(
      LEDGER_QUEUE,
      async (job: Job<LedgerIntegrityCheckJob>) => {
        await this.processor.handle(job);
      },
      { connection: this.connection, prefix: `${REDIS_KEY_PREFIX}:bull` },
    );

    void this.scheduleIntegrityCheck();
  }

  async destroy(): Promise<void> {
    await this.worker.close();
    await this.connection.quit();
  }

  private async scheduleIntegrityCheck(): Promise<void> {
    const { LEDGER_INTEGRITY_INTERVAL_MS, LEDGER_INTEGRITY_BATCH_SIZE } = this.fastify.config;

    await this.fastify.queues.resolve(QueueNameEnum.LEDGER).upsertJobScheduler(
      INTEGRITY_SCHEDULER_ID,
      { every: LEDGER_INTEGRITY_INTERVAL_MS },
      {
        name: LEDGER_INTEGRITY_CHECK_JOB,
        data: buildLedgerIntegrityCheckJob(LEDGER_INTEGRITY_BATCH_SIZE),
      },
    );
  }
}
