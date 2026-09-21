import { DEFAULT_MAX_RETRIES, DEFAULT_TIMEOUT_MS } from '@client/retry';
import type { FetchImpl, TransportConfig, VxrErpConfig } from '@client/vxr-erp.types';
import { VxrErpTransport } from '@client/vxr-erp-transport';
import { BillingNamespace } from '@namespaces/billing.namespace';
import { BillingPortalNamespace } from '@namespaces/billing-portal.namespace';
import { CheckoutNamespace } from '@namespaces/checkout.namespace';
import { LedgerNamespace } from '@namespaces/ledger.namespace';
import { PortalNamespace } from '@namespaces/portal.namespace';
import { TestHelpersNamespace } from '@namespaces/test-helpers.namespace';
import { AccountResource } from '@resources/account.resource';
import { ApiKeysResource } from '@resources/api-keys.resource';
import { CouponsResource } from '@resources/coupons.resource';
import { CreditNotesResource } from '@resources/credit-notes.resource';
import { CustomersResource } from '@resources/customers.resource';
import { DiscountsResource } from '@resources/discounts.resource';
import { EntitlementsResource } from '@resources/entitlements.resource';
import { InvoiceItemsResource } from '@resources/invoice-items.resource';
import { InvoicesResource } from '@resources/invoices.resource';
import { PaymentIntentsResource } from '@resources/payment-intents.resource';
import { PaymentLinksResource } from '@resources/payment-links.resource';
import { PortalMembershipsResource } from '@resources/portal-memberships.resource';
import { PricesResource } from '@resources/prices.resource';
import { ProductsResource } from '@resources/products.resource';
import { PromotionCodesResource } from '@resources/promotion-codes.resource';
import { RefundsResource } from '@resources/refunds.resource';
import { ReportingResource } from '@resources/reporting.resource';
import { SubscriptionItemsResource } from '@resources/subscription-items.resource';
import { SubscriptionsResource } from '@resources/subscriptions.resource';
import { TaxIdsResource } from '@resources/tax-ids.resource';
import { TaxRatesResource } from '@resources/tax-rates.resource';
import { UsersResource } from '@resources/users.resource';
import { WebhookDeliveriesResource } from '@resources/webhook-deliveries.resource';
import { WebhookEndpointsResource } from '@resources/webhook-endpoints.resource';

export class VxrErpClient {
  readonly customers: CustomersResource;
  readonly products: ProductsResource;
  readonly prices: PricesResource;
  readonly subscriptions: SubscriptionsResource;
  readonly subscriptionItems: SubscriptionItemsResource;
  readonly entitlements: EntitlementsResource;
  readonly invoices: InvoicesResource;
  readonly invoiceItems: InvoiceItemsResource;
  readonly creditNotes: CreditNotesResource;
  readonly coupons: CouponsResource;
  readonly promotionCodes: PromotionCodesResource;
  readonly discounts: DiscountsResource;
  readonly taxRates: TaxRatesResource;
  readonly taxIds: TaxIdsResource;
  readonly portalMemberships: PortalMembershipsResource;
  readonly paymentIntents: PaymentIntentsResource;
  readonly paymentLinks: PaymentLinksResource;
  readonly refunds: RefundsResource;
  readonly webhookEndpoints: WebhookEndpointsResource;
  readonly webhookDeliveries: WebhookDeliveriesResource;
  readonly users: UsersResource;
  readonly apiKeys: ApiKeysResource;
  readonly account: AccountResource;
  readonly reporting: ReportingResource;
  readonly billing: BillingNamespace;
  readonly billingPortal: BillingPortalNamespace;
  readonly checkout: CheckoutNamespace;
  readonly ledger: LedgerNamespace;
  readonly portal: PortalNamespace;
  readonly testHelpers: TestHelpersNamespace;

  private _transport: VxrErpTransport;

  constructor(vxrErpConfig: VxrErpConfig = {}) {
    this._transport = new VxrErpTransport(buildTransportConfig(vxrErpConfig));

    this.customers = new CustomersResource(this._transport);
    this.products = new ProductsResource(this._transport);
    this.prices = new PricesResource(this._transport);
    this.subscriptions = new SubscriptionsResource(this._transport);
    this.subscriptionItems = new SubscriptionItemsResource(this._transport);
    this.entitlements = new EntitlementsResource(this._transport);
    this.invoices = new InvoicesResource(this._transport);
    this.invoiceItems = new InvoiceItemsResource(this._transport);
    this.creditNotes = new CreditNotesResource(this._transport);
    this.coupons = new CouponsResource(this._transport);
    this.promotionCodes = new PromotionCodesResource(this._transport);
    this.discounts = new DiscountsResource(this._transport);
    this.taxRates = new TaxRatesResource(this._transport);
    this.taxIds = new TaxIdsResource(this._transport);
    this.portalMemberships = new PortalMembershipsResource(this._transport);
    this.paymentIntents = new PaymentIntentsResource(this._transport);
    this.paymentLinks = new PaymentLinksResource(this._transport);
    this.refunds = new RefundsResource(this._transport);
    this.webhookEndpoints = new WebhookEndpointsResource(this._transport);
    this.webhookDeliveries = new WebhookDeliveriesResource(this._transport);
    this.users = new UsersResource(this._transport);
    this.apiKeys = new ApiKeysResource(this._transport);
    this.account = new AccountResource(this._transport);
    this.reporting = new ReportingResource(this._transport);
    this.billing = new BillingNamespace(this._transport);
    this.billingPortal = new BillingPortalNamespace(this._transport);
    this.checkout = new CheckoutNamespace(this._transport);
    this.ledger = new LedgerNamespace(this._transport);
    this.portal = new PortalNamespace(this._transport);
    this.testHelpers = new TestHelpersNamespace(this._transport);
  }

  static isConfigured(vxrErpConfig: VxrErpConfig): boolean {
    return Boolean(vxrErpConfig.apiKey);
  }
}

function buildTransportConfig(vxrErpConfig: VxrErpConfig): TransportConfig {
  const DEFAULT_BASE_URL = '';

  const {
    baseUrl = DEFAULT_BASE_URL,
    apiKey,
    fetch: fetchImpl = resolveGlobalFetch(),
    maxRetries = DEFAULT_MAX_RETRIES,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    shouldGenerateIdempotencyKey = true,
  } = vxrErpConfig;

  return {
    baseUrl,
    apiKey: apiKey ?? null,
    fetch: fetchImpl,
    maxRetries,
    timeoutMs,
    shouldGenerateIdempotencyKey,
  };
}

function resolveGlobalFetch(): FetchImpl {
  return (input, init) => {
    return globalThis.fetch(input, init);
  };
}
