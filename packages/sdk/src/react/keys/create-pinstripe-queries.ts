import type { PinstripeClient } from '@client/pinstripe.client';
import { mergeQueryKeys } from '@lukemorales/query-key-factory';
import { createCustomerQueries } from '@react/keys/customer.keys';
import { createDiscountQueries } from '@react/keys/discount.keys';
import { createEntitlementQueries } from '@react/keys/entitlement.keys';
import { createInvoiceQueries } from '@react/keys/invoice.keys';
import { createLedgerQueries } from '@react/keys/ledger.keys';
import { createMeterQueries } from '@react/keys/meter.keys';
import { createPaymentQueries } from '@react/keys/payment.keys';
import { createPriceQueries } from '@react/keys/price.keys';
import { createProductQueries } from '@react/keys/product.keys';
import { createReportingQueries } from '@react/keys/reporting.keys';
import { createSubscriptionQueries } from '@react/keys/subscription.keys';
import { createTestClockQueries } from '@react/keys/test-clock.keys';
import { createWebhookQueries } from '@react/keys/webhook.keys';

export function createPinstripeQueries(client: PinstripeClient) {
  return mergeQueryKeys(
    createCustomerQueries(client),
    createDiscountQueries(client),
    createProductQueries(client),
    createPriceQueries(client),
    createSubscriptionQueries(client),
    createEntitlementQueries(client),
    createInvoiceQueries(client),
    createPaymentQueries(client),
    createWebhookQueries(client),
    createMeterQueries(client),
    createTestClockQueries(client),
    createLedgerQueries(client),
    createReportingQueries(client),
  );
}

export type PinstripeQueries = ReturnType<typeof createPinstripeQueries>;
