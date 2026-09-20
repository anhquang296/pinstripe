import type { PinstripeTransport } from '@client/pinstripe-transport';
import { PortalAccountResource } from '@resources/portal/account.resource';
import { PortalBankTransfersResource } from '@resources/portal/bank-transfers.resource';
import { PortalInvoiceComparisonsResource } from '@resources/portal/invoice-comparisons.resource';
import { PortalInvoiceRemindersResource } from '@resources/portal/invoice-reminders.resource';
import { PortalInvoiceTotalsResource } from '@resources/portal/invoice-totals.resource';
import { PortalInvoicesResource } from '@resources/portal/invoices.resource';
import { PortalLinksResource } from '@resources/portal/links.resource';
import { PortalPaymentMethodsResource } from '@resources/portal/payment-methods.resource';
import { PortalPaymentsResource } from '@resources/portal/payments.resource';
import { PortalRequestsResource } from '@resources/portal/requests.resource';
import { PortalSessionsResource } from '@resources/portal/sessions.resource';
import { PortalSubscriptionsResource } from '@resources/portal/subscriptions.resource';
import { PortalUsageResource } from '@resources/portal/usage.resource';

export class PortalNamespace {
  readonly links: PortalLinksResource;
  readonly sessions: PortalSessionsResource;
  readonly account: PortalAccountResource;
  readonly invoices: PortalInvoicesResource;
  readonly invoiceTotals: PortalInvoiceTotalsResource;
  readonly invoiceComparisons: PortalInvoiceComparisonsResource;
  readonly invoiceReminders: PortalInvoiceRemindersResource;
  readonly usage: PortalUsageResource;
  readonly requests: PortalRequestsResource;
  readonly bankTransfers: PortalBankTransfersResource;
  readonly payments: PortalPaymentsResource;
  readonly subscriptions: PortalSubscriptionsResource;
  readonly paymentMethods: PortalPaymentMethodsResource;

  constructor(transport: PinstripeTransport) {
    this.links = new PortalLinksResource(transport);
    this.sessions = new PortalSessionsResource(transport);
    this.account = new PortalAccountResource(transport);
    this.invoices = new PortalInvoicesResource(transport);
    this.invoiceTotals = new PortalInvoiceTotalsResource(transport);
    this.invoiceComparisons = new PortalInvoiceComparisonsResource(transport);
    this.invoiceReminders = new PortalInvoiceRemindersResource(transport);
    this.usage = new PortalUsageResource(transport);
    this.requests = new PortalRequestsResource(transport);
    this.bankTransfers = new PortalBankTransfersResource(transport);
    this.payments = new PortalPaymentsResource(transport);
    this.subscriptions = new PortalSubscriptionsResource(transport);
    this.paymentMethods = new PortalPaymentMethodsResource(transport);
  }
}
