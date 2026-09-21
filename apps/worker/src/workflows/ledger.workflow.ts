import type { LedgerIntegrityCheckJob } from '@vxrerp/core/queues';
import {
  buildLedgerIntegrityCheckJob,
  LEDGER_INTEGRITY_CHECK_JOB,
  LEDGER_QUEUE,
  QueueNameEnum,
} from '@vxrerp/core/queues';
import { LedgerIntegrityCheckProcessor } from '@workflows/processors/ledger-integrity-check.processor';
import type { Workflow } from '@workflows/workflow';
import type { Job } from 'bullmq';
import { Worker } from 'bullmq';
import type { FastifyInstance } from 'fastify';

const INTEGRITY_SCHEDULER_ID = 'ledger-integrity-scheduler';

export class LedgerWorkflow implements Workflow {
  private readonly worker: Worker<LedgerIntegrityCheckJob>;
  private readonly processor: LedgerIntegrityCheckProcessor;

  constructor(private readonly fastify: FastifyInstance) {
    this.processor = new LedgerIntegrityCheckProcessor(fastify);
    this.worker = new Worker<LedgerIntegrityCheckJob>(
      LEDGER_QUEUE,
      async (job: Job<LedgerIntegrityCheckJob>) => {
        await this.processor.handle(job);
      },
      { connection: fastify.workerConnection, prefix: fastify.queuePrefix },
    );

    void this.dispatchIntegritySchedule().catch((error: unknown) => {
      fastify.log.error({ error }, '[LedgerWorkflow] dispatchIntegritySchedule() error');
    });
  }

  async destroy(): Promise<void> {
    await this.worker.close();
  }

  private async dispatchIntegritySchedule(): Promise<void> {
    const { ledgerIntegrityIntervalMs, ledgerIntegrityBatchSize } = this.fastify.workflowSchedules;

    await this.fastify.queues.resolve(QueueNameEnum.LEDGER).upsertJobScheduler(
      INTEGRITY_SCHEDULER_ID,
      { every: ledgerIntegrityIntervalMs },
      {
        name: LEDGER_INTEGRITY_CHECK_JOB,
        data: buildLedgerIntegrityCheckJob(ledgerIntegrityBatchSize),
      },
    );
  }
}
