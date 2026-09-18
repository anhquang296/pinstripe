import type { FastifyInstance } from 'fastify';

export class PspCallbackPollProcessor {
  constructor(private readonly fastify: FastifyInstance) {}

  async handle(): Promise<void> {
    const drained = await this.fastify.paymentService.drainProviderEvents();

    if (drained > 0) {
      this.fastify.log.info(
        { drained },
        '[PspCallbackPollProcessor] handle() applied simulated processor callbacks',
      );
    }
  }
}
