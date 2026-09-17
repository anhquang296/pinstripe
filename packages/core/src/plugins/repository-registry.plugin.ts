import { CreditNoteRepository } from '@repositories/credit-note.repository';
import { CustomerRepository } from '@repositories/customer.repository';
import { EntitlementRepository } from '@repositories/entitlement.repository';
import { IdempotencyKeyRepository } from '@repositories/idempotency-key.repository';
import { InvoiceRepository } from '@repositories/invoice.repository';
import { LedgerAccountRepository } from '@repositories/ledger-account.repository';
import { LedgerTransactionRepository } from '@repositories/ledger-transaction.repository';
import { MeterRepository } from '@repositories/meter.repository';
import { MeterEventRepository } from '@repositories/meter-event.repository';
import { NumberSequenceRepository } from '@repositories/number-sequence.repository';
import { OutboxEventRepository } from '@repositories/outbox-event.repository';
import { PaymentIntentRepository } from '@repositories/payment-intent.repository';
import { PriceRepository } from '@repositories/price.repository';
import { ProductRepository } from '@repositories/product.repository';
import { RefundRepository } from '@repositories/refund.repository';
import { ReportingRepository } from '@repositories/reporting.repository';
import { SubscriptionRepository } from '@repositories/subscription.repository';
import { TestClockRepository } from '@repositories/test-clock.repository';
import { WebhookRepository } from '@repositories/webhook.repository';
import fp from 'fastify-plugin';

export const repositoryRegistryPlugin = fp(async (fastify) => {
  fastify.decorate('customerRepository', new CustomerRepository(fastify.database));
  fastify.decorate('idempotencyKeyRepository', new IdempotencyKeyRepository(fastify.database));
  fastify.decorate('ledgerAccountRepository', new LedgerAccountRepository(fastify.database));
  fastify.decorate(
    'ledgerTransactionRepository',
    new LedgerTransactionRepository(fastify.database),
  );
  fastify.decorate('meterRepository', new MeterRepository(fastify.database));
  fastify.decorate('meterEventRepository', new MeterEventRepository(fastify.database));
  fastify.decorate('outboxEventRepository', new OutboxEventRepository(fastify.database));
  fastify.decorate('priceRepository', new PriceRepository(fastify.database));
  fastify.decorate('productRepository', new ProductRepository(fastify.database));
  fastify.decorate('entitlementRepository', new EntitlementRepository(fastify.database));
  fastify.decorate('subscriptionRepository', new SubscriptionRepository(fastify.database));
  fastify.decorate('testClockRepository', new TestClockRepository(fastify.database));
  fastify.decorate('invoiceRepository', new InvoiceRepository(fastify.database));
  fastify.decorate('creditNoteRepository', new CreditNoteRepository(fastify.database));
  fastify.decorate('numberSequenceRepository', new NumberSequenceRepository(fastify.database));
  fastify.decorate('paymentIntentRepository', new PaymentIntentRepository(fastify.database));
  fastify.decorate('refundRepository', new RefundRepository(fastify.database));
  fastify.decorate('webhookRepository', new WebhookRepository(fastify.database));
  fastify.decorate('reportingRepository', new ReportingRepository(fastify.database));
});
