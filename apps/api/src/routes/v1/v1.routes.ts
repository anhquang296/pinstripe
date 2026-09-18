import { verifyApiRequest } from '@hooks/verify-api-request';
import { expandPlugin } from '@plugins/expand.plugin';
import { idempotencyPlugin } from '@plugins/idempotency.plugin';
import { rateLimitPlugin } from '@plugins/rate-limit.plugin';
import { balanceRoutes } from '@routes/v1/balance/balance.routes';
import { balanceTransactionsRoutes } from '@routes/v1/balance-transactions/balance-transactions.routes';
import { billingPortalRoutes } from '@routes/v1/billing-portal/billing-portal.routes';
import { checkoutSessionsRoutes } from '@routes/v1/checkout-sessions/checkout-sessions.routes';
import { couponsRoutes } from '@routes/v1/coupons/coupons.routes';
import { creditNotesRoutes } from '@routes/v1/credit-notes/credit-notes.routes';
import { customersRoutes } from '@routes/v1/customers/customers.routes';
import { discountsRoutes } from '@routes/v1/discounts/discounts.routes';
import { disputesRoutes } from '@routes/v1/disputes/disputes.routes';
import { entitlementsRoutes } from '@routes/v1/entitlements/entitlements.routes';
import { eventsRoutes } from '@routes/v1/events/events.routes';
import { invoiceItemsRoutes } from '@routes/v1/invoice-items/invoice-items.routes';
import { invoicesRoutes } from '@routes/v1/invoices/invoices.routes';
import { meterEventsRoutes } from '@routes/v1/meter-events/meter-events.routes';
import { metersRoutes } from '@routes/v1/meters/meters.routes';
import { paymentIntentsRoutes } from '@routes/v1/payment-intents/payment-intents.routes';
import { paymentLinksRoutes } from '@routes/v1/payment-links/payment-links.routes';
import { paymentMethodsRoutes } from '@routes/v1/payment-methods/payment-methods.routes';
import { payoutsRoutes } from '@routes/v1/payouts/payouts.routes';
import { pricesRoutes } from '@routes/v1/prices/prices.routes';
import { productsRoutes } from '@routes/v1/products/products.routes';
import { promotionCodesRoutes } from '@routes/v1/promotion-codes/promotion-codes.routes';
import { refundsRoutes } from '@routes/v1/refunds/refunds.routes';
import { setupIntentsRoutes } from '@routes/v1/setup-intents/setup-intents.routes';
import { subscriptionItemsRoutes } from '@routes/v1/subscription-items/subscription-items.routes';
import { subscriptionsRoutes } from '@routes/v1/subscriptions/subscriptions.routes';
import { taxIdsRoutes } from '@routes/v1/tax-ids/tax-ids.routes';
import { taxRatesRoutes } from '@routes/v1/tax-rates/tax-rates.routes';
import { testClocksRoutes } from '@routes/v1/test-clocks/test-clocks.routes';
import { webhookDeliveriesRoutes } from '@routes/v1/webhook-deliveries/webhook-deliveries.routes';
import { webhookEndpointsRoutes } from '@routes/v1/webhook-endpoints/webhook-endpoints.routes';
import { Type } from '@sinclair/typebox';
import { ApiResponse } from '@utils/api-response';
import type { FastifyInstance } from 'fastify';

export async function v1Routes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', verifyApiRequest);

  await fastify.register(rateLimitPlugin);
  await fastify.register(idempotencyPlugin);
  await fastify.register(expandPlugin);

  await fastify.register(customersRoutes, { prefix: '/customers' });
  await fastify.register(productsRoutes, { prefix: '/products' });
  await fastify.register(pricesRoutes, { prefix: '/prices' });
  await fastify.register(subscriptionsRoutes, { prefix: '/subscriptions' });
  await fastify.register(subscriptionItemsRoutes, { prefix: '/subscription_items' });
  await fastify.register(entitlementsRoutes, { prefix: '/entitlements' });
  await fastify.register(eventsRoutes, { prefix: '/events' });
  await fastify.register(invoicesRoutes, { prefix: '/invoices' });
  await fastify.register(invoiceItemsRoutes, { prefix: '/invoiceitems' });
  await fastify.register(creditNotesRoutes, { prefix: '/credit_notes' });
  await fastify.register(couponsRoutes, { prefix: '/coupons' });
  await fastify.register(promotionCodesRoutes, { prefix: '/promotion_codes' });
  await fastify.register(discountsRoutes, { prefix: '/discounts' });
  await fastify.register(taxRatesRoutes, { prefix: '/tax_rates' });
  await fastify.register(taxIdsRoutes, { prefix: '/tax_ids' });
  await fastify.register(paymentIntentsRoutes, { prefix: '/payment_intents' });
  await fastify.register(paymentMethodsRoutes, { prefix: '/payment_methods' });
  await fastify.register(setupIntentsRoutes, { prefix: '/setup_intents' });
  await fastify.register(refundsRoutes, { prefix: '/refunds' });
  await fastify.register(balanceRoutes, { prefix: '/balance' });
  await fastify.register(balanceTransactionsRoutes, { prefix: '/balance_transactions' });
  await fastify.register(payoutsRoutes, { prefix: '/payouts' });
  await fastify.register(paymentLinksRoutes, { prefix: '/payment_links' });
  await fastify.register(checkoutSessionsRoutes, { prefix: '/checkout/sessions' });
  await fastify.register(billingPortalRoutes, { prefix: '/billing_portal' });
  await fastify.register(disputesRoutes, { prefix: '/disputes' });
  await fastify.register(webhookEndpointsRoutes, { prefix: '/webhook_endpoints' });
  await fastify.register(webhookDeliveriesRoutes, { prefix: '/webhook_deliveries' });
  await fastify.register(metersRoutes, { prefix: '/billing/meters' });
  await fastify.register(meterEventsRoutes, { prefix: '/billing' });
  await fastify.register(testClocksRoutes, { prefix: '/test_helpers/test_clocks' });

  fastify.get(
    '/ping',
    { schema: { response: { 200: Type.Object({ now: Type.String() }) } } },
    async (_request, reply) => {
      return ApiResponse.success(reply, { now: fastify.clock.now().toISOString() });
    },
  );
}
