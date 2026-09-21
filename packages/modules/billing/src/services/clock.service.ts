import type { Invoice, Subscription } from '@database/schemas';
import type { FastifyInstance } from 'fastify';

export class ClockService {
  constructor(private readonly fastify: FastifyInstance) {}

  async resolveNow(testClockId: string | null): Promise<Date> {
    if (testClockId) {
      const testClock = await this.fastify.testClockRepository.getTestClock(testClockId);

      return new Date(testClock.frozenTime);
    }

    return this.fastify.clock.now();
  }

  async resolveCustomerNow(customerId: string): Promise<Date> {
    const customer = await this.fastify.customerRepository.getCustomer(customerId);

    return this.resolveNow(customer.testClockId);
  }

  async resolveSubscriptionNow(subscription: Subscription): Promise<Date> {
    return this.resolveNow(subscription.testClockId);
  }

  async resolveInvoiceNow(invoice: Invoice): Promise<Date> {
    return this.resolveCustomerNow(invoice.customerId);
  }
}
