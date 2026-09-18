import type { Invoice, Subscription } from '@database/schemas';
import { NotFoundError } from '@errors/app.error';
import type { FastifyInstance } from 'fastify';

export class ClockService {
  constructor(private readonly fastify: FastifyInstance) {}

  async resolveNow(testClockId: string | null): Promise<Date> {
    if (testClockId) {
      const testClock = await this.fastify.testClockRepository.findTestClock(testClockId);

      if (testClock) {
        return new Date(testClock.frozenTime);
      }

      throw new NotFoundError(`No such test clock: ${testClockId}`);
    }

    return this.fastify.clock.now();
  }

  async resolveCustomerNow(customerId: string): Promise<Date> {
    const customer = await this.fastify.customerRepository.findCustomer(customerId);

    if (customer) {
      return this.resolveNow(customer.testClockId);
    }

    throw new NotFoundError(`No such customer: ${customerId}`);
  }

  async resolveSubscriptionNow(subscription: Subscription): Promise<Date> {
    return this.resolveNow(subscription.testClockId);
  }

  async resolveInvoiceNow(invoice: Invoice): Promise<Date> {
    return this.resolveCustomerNow(invoice.customerId);
  }
}
