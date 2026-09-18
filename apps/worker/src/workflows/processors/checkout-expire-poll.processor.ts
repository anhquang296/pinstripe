import type { FastifyInstance } from 'fastify';

export class CheckoutExpirePollProcessor {
  constructor(private readonly fastify: FastifyInstance) {}

  async handle(): Promise<void> {
    const expired = await this.fastify.checkoutService.expireCheckoutSessions();

    if (expired > 0) {
      this.fastify.log.info(
        { expired },
        '[CheckoutExpirePollProcessor] handle() expired the sessions past their deadline',
      );
    }
  }
}
