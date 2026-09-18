import type { FastifyInstance } from 'fastify';

export class PayoutSettlePollProcessor {
  constructor(private readonly fastify: FastifyInstance) {}

  async handle(): Promise<void> {
    const settled = await this.fastify.payoutService.settleDuePayouts();

    if (settled > 0) {
      this.fastify.log.info(
        { settled },
        '[PayoutSettlePollProcessor] handle() asked the processor to settle due payouts',
      );
    }
  }
}
