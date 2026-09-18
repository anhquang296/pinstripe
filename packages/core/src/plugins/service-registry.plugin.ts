import { ApiKeyService } from '@services/api-key.service';
import { BillingRunService } from '@services/billing-run.service';
import { ClockService } from '@services/clock.service';
import { CouponService } from '@services/coupon.service';
import { CreditNoteService } from '@services/credit-note.service';
import { CustomerService } from '@services/customer.service';
import { CustomerBalanceTransactionService } from '@services/customer-balance-transaction.service';
import { DiscountService } from '@services/discount.service';
import { DunningService } from '@services/dunning.service';
import { EntitlementService } from '@services/entitlement.service';
import { EventService } from '@services/event.service';
import { ExpansionService } from '@services/expansion.service';
import { IdempotencyService } from '@services/idempotency.service';
import { InvoiceService } from '@services/invoice.service';
import { InvoiceItemService } from '@services/invoice-item.service';
import { LedgerService } from '@services/ledger.service';
import { MeterService } from '@services/meter.service';
import { MeterEventService } from '@services/meter-event.service';
import { OutboxService } from '@services/outbox.service';
import { PaymentService } from '@services/payment.service';
import { PriceService } from '@services/price.service';
import { ProductService } from '@services/product.service';
import { PromotionCodeService } from '@services/promotion-code.service';
import { RatingService } from '@services/rating.service';
import { ReconciliationService } from '@services/reconciliation.service';
import { RefundService } from '@services/refund.service';
import { ReportingService } from '@services/reporting.service';
import { SubscriptionService } from '@services/subscription.service';
import { SubscriptionItemService } from '@services/subscription-item.service';
import { TaxService } from '@services/tax.service';
import { TaxIdService } from '@services/tax-id.service';
import { TaxRateService } from '@services/tax-rate.service';
import { TestClockService } from '@services/test-clock.service';
import { WebhookService } from '@services/webhook.service';
import fp from 'fastify-plugin';

export const serviceRegistryPlugin = fp(async (fastify) => {
  fastify.decorate(
    'idempotencyService',
    new IdempotencyService(fastify, { retentionHours: fastify.config.IDEMPOTENCY_RETENTION_HOURS }),
  );
  fastify.decorate('outboxService', new OutboxService(fastify));
  fastify.decorate('apiKeyService', new ApiKeyService(fastify));
  fastify.decorate('customerService', new CustomerService(fastify));
  fastify.decorate('eventService', new EventService(fastify));
  fastify.decorate('expansionService', new ExpansionService(fastify));
  fastify.decorate('productService', new ProductService(fastify));
  fastify.decorate('priceService', new PriceService(fastify));
  fastify.decorate('ledgerService', new LedgerService(fastify));
  fastify.decorate('entitlementService', new EntitlementService(fastify));
  fastify.decorate('clockService', new ClockService(fastify));
  fastify.decorate('subscriptionService', new SubscriptionService(fastify));
  fastify.decorate('subscriptionItemService', new SubscriptionItemService(fastify));
  fastify.decorate('ratingService', new RatingService(fastify));
  fastify.decorate(
    'invoiceService',
    new InvoiceService(fastify, { dueDays: fastify.config.INVOICE_DUE_DAYS }),
  );
  fastify.decorate('invoiceItemService', new InvoiceItemService(fastify));
  fastify.decorate('couponService', new CouponService(fastify));
  fastify.decorate('promotionCodeService', new PromotionCodeService(fastify));
  fastify.decorate('discountService', new DiscountService(fastify));
  fastify.decorate('taxRateService', new TaxRateService(fastify));
  fastify.decorate('taxIdService', new TaxIdService(fastify));
  fastify.decorate('taxService', new TaxService(fastify));
  fastify.decorate(
    'customerBalanceTransactionService',
    new CustomerBalanceTransactionService(fastify),
  );
  fastify.decorate('creditNoteService', new CreditNoteService(fastify));
  fastify.decorate('paymentService', new PaymentService(fastify));
  fastify.decorate('refundService', new RefundService(fastify));
  fastify.decorate('webhookService', new WebhookService(fastify));
  fastify.decorate('reportingService', new ReportingService(fastify));
  fastify.decorate('reconciliationService', new ReconciliationService(fastify));
  fastify.decorate(
    'dunningService',
    new DunningService(fastify, {
      batchSize: fastify.workflowSchedules.dunningBatchSize,
      retryDelayDays: fastify.workflowSchedules.dunningRetryDelayDays,
    }),
  );
  fastify.decorate(
    'billingRunService',
    new BillingRunService(fastify, {
      batchSize: fastify.workflowSchedules.billingRunBatchSize,
      finalizeDelayMs: fastify.workflowSchedules.invoiceFinalizeDelayMs,
    }),
  );
  fastify.decorate('testClockService', new TestClockService(fastify));
  fastify.decorate('meterService', new MeterService(fastify));
  fastify.decorate(
    'meterEventService',
    new MeterEventService(fastify, { dedupWindowDays: fastify.config.METER_DEDUP_WINDOW_DAYS }),
  );
});
