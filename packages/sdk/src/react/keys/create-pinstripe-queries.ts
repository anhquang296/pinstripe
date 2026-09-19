import type { PinstripeClient } from '@client/pinstripe.client';
import { mergeQueryKeys } from '@lukemorales/query-key-factory';
import { createAccountQueries } from '@react/keys/account.keys';
import { createApiKeyQueries } from '@react/keys/api-key.keys';
import { createBillingPortalQueries } from '@react/keys/billing-portal.keys';
import { createCheckoutQueries } from '@react/keys/checkout.keys';
import { createCustomerQueries } from '@react/keys/customer.keys';
import { createDiscountQueries } from '@react/keys/discount.keys';
import { createEntitlementQueries } from '@react/keys/entitlement.keys';
import { createInvoiceQueries } from '@react/keys/invoice.keys';
import { createLedgerQueries } from '@react/keys/ledger.keys';
import { createMeterQueries } from '@react/keys/meter.keys';
import { createPaymentQueries } from '@react/keys/payment.keys';
import { createPaymentLinkQueries } from '@react/keys/payment-link.keys';
import { createPortalQueries } from '@react/keys/portal.keys';
import { createPriceQueries } from '@react/keys/price.keys';
import { createProductQueries } from '@react/keys/product.keys';
import { createReportingQueries } from '@react/keys/reporting.keys';
import { createSubscriptionQueries } from '@react/keys/subscription.keys';
import { createTaxQueries } from '@react/keys/tax.keys';
import { createTestClockQueries } from '@react/keys/test-clock.keys';
import { createUserQueries } from '@react/keys/user.keys';
import { createWebhookQueries } from '@react/keys/webhook.keys';

export function createPinstripeQueries(client: PinstripeClient) {
  return mergeQueryKeys(
    createCustomerQueries(client),
    createDiscountQueries(client),
    createTaxQueries(client),
    createProductQueries(client),
    createPriceQueries(client),
    createSubscriptionQueries(client),
    createEntitlementQueries(client),
    createInvoiceQueries(client),
    createPaymentQueries(client),
    createPaymentLinkQueries(client),
    createCheckoutQueries(client),
    createBillingPortalQueries(client),
    createWebhookQueries(client),
    createMeterQueries(client),
    createTestClockQueries(client),
    createLedgerQueries(client),
    createReportingQueries(client),
    createUserQueries(client),
    createAccountQueries(client),
    createApiKeyQueries(client),
    createPortalQueries(client),
  );
}

export type PinstripeQueries = ReturnType<typeof createPinstripeQueries>;
