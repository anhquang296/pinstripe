import type { Permission } from '@pinstripe/core/contracts';
import { PermissionEnum } from '@pinstripe/core/contracts';

export const READ_OPERATION_PREFIXES = ['find', 'get'];

export const OPERATION_PERMISSIONS: Record<string, Permission> = {
  customers: PermissionEnum.CUSTOMER_WRITE,
  'customers.delete': PermissionEnum.CUSTOMER_DELETE,
  invoices: PermissionEnum.INVOICE_WRITE,
  'invoices.void': PermissionEnum.INVOICE_VOID,
  invoiceItems: PermissionEnum.INVOICE_WRITE,
  creditNotes: PermissionEnum.CREDIT_NOTE_WRITE,
  refunds: PermissionEnum.REFUND_WRITE,
  disputes: PermissionEnum.REFUND_WRITE,
  paymentIntents: PermissionEnum.REFUND_WRITE,
  paymentMethods: PermissionEnum.REFUND_WRITE,
  setupIntents: PermissionEnum.REFUND_WRITE,
  payouts: PermissionEnum.REFUND_WRITE,
  products: PermissionEnum.CATALOG_WRITE,
  prices: PermissionEnum.CATALOG_WRITE,
  'billing.meters': PermissionEnum.CATALOG_WRITE,
  coupons: PermissionEnum.CATALOG_WRITE,
  promotionCodes: PermissionEnum.CATALOG_WRITE,
  discounts: PermissionEnum.CATALOG_WRITE,
  taxRates: PermissionEnum.CATALOG_WRITE,
  taxIds: PermissionEnum.CATALOG_WRITE,
  subscriptions: PermissionEnum.SUBSCRIPTION_WRITE,
  subscriptionItems: PermissionEnum.SUBSCRIPTION_WRITE,
  'checkout.sessions': PermissionEnum.SUBSCRIPTION_WRITE,
  paymentLinks: PermissionEnum.SUBSCRIPTION_WRITE,
  'billingPortal.configurations': PermissionEnum.SUBSCRIPTION_WRITE,
  'billingPortal.sessions': PermissionEnum.SUBSCRIPTION_WRITE,
  'billing.meterEvents': PermissionEnum.SUBSCRIPTION_WRITE,
  'billing.meterEventBatches': PermissionEnum.SUBSCRIPTION_WRITE,
  webhookEndpoints: PermissionEnum.INTEGRATION_WRITE,
  'webhookDeliveries.replay': PermissionEnum.INTEGRATION_WRITE,
  'testHelpers.testClocks': PermissionEnum.TEST_CLOCK_WRITE,
};
