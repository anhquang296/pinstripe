import { ApiKeyRepository } from '@repositories/api-key.repository';
import { CouponRepository } from '@repositories/coupon.repository';
import { CreditNoteRepository } from '@repositories/credit-note.repository';
import { CustomerRepository } from '@repositories/customer.repository';
import { CustomerBalanceTransactionRepository } from '@repositories/customer-balance-transaction.repository';
import { DiscountRepository } from '@repositories/discount.repository';
import { EntitlementRepository } from '@repositories/entitlement.repository';
import { EventRepository } from '@repositories/event.repository';
import { IdempotencyKeyRepository } from '@repositories/idempotency-key.repository';
import { InvoiceRepository } from '@repositories/invoice.repository';
import { InvoiceItemRepository } from '@repositories/invoice-item.repository';
import { LedgerAccountRepository } from '@repositories/ledger-account.repository';
import { LedgerTransactionRepository } from '@repositories/ledger-transaction.repository';
import { MeterRepository } from '@repositories/meter.repository';
import { MeterEventRepository } from '@repositories/meter-event.repository';
import { NumberSequenceRepository } from '@repositories/number-sequence.repository';
import { OutboxEventRepository } from '@repositories/outbox-event.repository';
import { PaymentIntentRepository } from '@repositories/payment-intent.repository';
import { PaymentMethodRepository } from '@repositories/payment-method.repository';
import { PriceRepository } from '@repositories/price.repository';
import { ProductRepository } from '@repositories/product.repository';
import { PromotionCodeRepository } from '@repositories/promotion-code.repository';
import { PspEventRepository } from '@repositories/psp-event.repository';
import { RefundRepository } from '@repositories/refund.repository';
import { ReportingRepository } from '@repositories/reporting.repository';
import { SetupIntentRepository } from '@repositories/setup-intent.repository';
import { SubscriptionRepository } from '@repositories/subscription.repository';
import { TaxIdRepository } from '@repositories/tax-id.repository';
import { TaxRateRepository } from '@repositories/tax-rate.repository';
import { TestClockRepository } from '@repositories/test-clock.repository';
import { WebhookRepository } from '@repositories/webhook.repository';
import fp from 'fastify-plugin';

export const repositoryRegistryPlugin = fp(async (fastify) => {
  fastify.decorate('apiKeyRepository', new ApiKeyRepository(fastify.database));
  fastify.decorate('customerRepository', new CustomerRepository(fastify.database));
  fastify.decorate(
    'customerBalanceTransactionRepository',
    new CustomerBalanceTransactionRepository(fastify.database),
  );
  fastify.decorate('eventRepository', new EventRepository(fastify.database));
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
  fastify.decorate('invoiceItemRepository', new InvoiceItemRepository(fastify.database));
  fastify.decorate('creditNoteRepository', new CreditNoteRepository(fastify.database));
  fastify.decorate('numberSequenceRepository', new NumberSequenceRepository(fastify.database));
  fastify.decorate('paymentIntentRepository', new PaymentIntentRepository(fastify.database));
  fastify.decorate('paymentMethodRepository', new PaymentMethodRepository(fastify.database));
  fastify.decorate('setupIntentRepository', new SetupIntentRepository(fastify.database));
  fastify.decorate('pspEventRepository', new PspEventRepository(fastify.database));
  fastify.decorate('refundRepository', new RefundRepository(fastify.database));
  fastify.decorate('webhookRepository', new WebhookRepository(fastify.database));
  fastify.decorate('reportingRepository', new ReportingRepository(fastify.database));
  fastify.decorate('couponRepository', new CouponRepository(fastify.database));
  fastify.decorate('promotionCodeRepository', new PromotionCodeRepository(fastify.database));
  fastify.decorate('discountRepository', new DiscountRepository(fastify.database));
  fastify.decorate('taxRateRepository', new TaxRateRepository(fastify.database));
  fastify.decorate('taxIdRepository', new TaxIdRepository(fastify.database));
});
