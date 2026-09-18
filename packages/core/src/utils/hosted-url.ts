import { createHmac, timingSafeEqual } from 'node:crypto';

import _ from 'lodash';

const TOKEN_LENGTH = 32;

export enum HostedResourceEnum {
  CHECKOUT_SESSION = 'checkout',
  PAYMENT_LINK = 'pay',
  INVOICE = 'invoice',
}
export type HostedResource = `${HostedResourceEnum}`;

export class HostedUrlFactory {
  private _baseUrl: string;
  private _secret: string;

  constructor(baseUrl: string, secret: string) {
    this._baseUrl = _.trimEnd(baseUrl, '/');
    this._secret = secret;
  }

  buildToken(resource: HostedResource, id: string): string {
    return createHmac('sha256', this._secret)
      .update(`${resource}:${id}`)
      .digest('hex')
      .slice(0, TOKEN_LENGTH);
  }

  buildCheckoutUrl(checkoutSessionId: string): string {
    return this.buildUrl(HostedResourceEnum.CHECKOUT_SESSION, checkoutSessionId, '');
  }

  buildCheckoutCompleteUrl(checkoutSessionId: string): string {
    return this.buildUrl(HostedResourceEnum.CHECKOUT_SESSION, checkoutSessionId, '/complete');
  }

  buildPaymentLinkUrl(paymentLinkId: string): string {
    return this.buildUrl(HostedResourceEnum.PAYMENT_LINK, paymentLinkId, '');
  }

  buildInvoiceUrl(invoiceId: string): string {
    return this.buildUrl(HostedResourceEnum.INVOICE, invoiceId, '');
  }

  buildInvoicePdfUrl(invoiceId: string): string {
    return this.buildUrl(HostedResourceEnum.INVOICE, invoiceId, '/pdf');
  }

  verifyToken(resource: HostedResource, id: string, token: string): boolean {
    const expected = Buffer.from(this.buildToken(resource, id));
    const provided = Buffer.from(token);

    if (expected.length === provided.length) {
      return timingSafeEqual(expected, provided);
    }

    return false;
  }

  private buildUrl(resource: HostedResource, id: string, suffix: string): string {
    const token = this.buildToken(resource, id);

    return `${this._baseUrl}/hosted/${resource}/${encodeURIComponent(id)}${suffix}?token=${token}`;
  }
}
