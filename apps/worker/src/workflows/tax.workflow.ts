import type { TaxIdVerifyJob } from '@vxrerp/billing/queues';
import { TAX_QUEUE } from '@vxrerp/billing/queues';
import { TaxIdVerifyProcessor } from '@workflows/processors/tax-id-verify.processor';
import type { Workflow } from '@workflows/workflow';
import type { Job } from 'bullmq';
import { Worker } from 'bullmq';
import type { FastifyInstance } from 'fastify';

export class TaxWorkflow implements Workflow {
  private readonly worker: Worker<TaxIdVerifyJob>;
  private readonly processor: TaxIdVerifyProcessor;

  constructor(fastify: FastifyInstance) {
    this.processor = new TaxIdVerifyProcessor(fastify);
    this.worker = new Worker<TaxIdVerifyJob>(
      TAX_QUEUE,
      async (job: Job<TaxIdVerifyJob>) => {
        await this.processor.handle(job);
      },
      { connection: fastify.workerConnection, prefix: fastify.queuePrefix },
    );
  }

  async destroy(): Promise<void> {
    await this.worker.close();
  }
}
