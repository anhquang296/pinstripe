import type { TaxIdVerifyJob } from '@vxrerp/billing/queues';
import type { Job } from 'bullmq';
import type { FastifyInstance } from 'fastify';

export class TaxIdVerifyProcessor {
  constructor(private readonly fastify: FastifyInstance) {}

  async handle(job: Job<TaxIdVerifyJob>): Promise<void> {
    const taxId = await this.fastify.taxIdService.verifyTaxId(job.data.taxIdId);

    this.fastify.log.info(
      { taxIdId: taxId.id, verificationStatus: taxId.verification.status },
      '[TaxIdVerifyProcessor] handle() completed',
    );
  }
}
