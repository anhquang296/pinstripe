import type { FastifyInstance } from 'fastify';

export class InvoiceReminderRunProcessor {
  constructor(private readonly fastify: FastifyInstance) {}

  async handle(): Promise<void> {
    const invoiceReminderRunResult =
      await this.fastify.invoiceReminderService.dispatchInvoiceReminders();

    this.fastify.log.info(
      { invoiceReminderRunResult },
      '[InvoiceReminderRunProcessor] handle() completed',
    );
  }
}
