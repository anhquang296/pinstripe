import { describe, expect, it } from 'vitest';

import { HostedResourceEnum, HostedUrlFactory } from './hosted-url';

const BASE_URL = 'https://pay.pinstripe.test/';
const SECRET = 'hosted-url-secret-for-tests';

function setup(secret = SECRET) {
  return new HostedUrlFactory(BASE_URL, secret);
}

describe('HostedUrlFactory', () => {
  it('builds a checkout url with the token that signs that session', () => {
    const hostedUrlFactory = setup();

    const url = hostedUrlFactory.buildCheckoutUrl('cs_123');
    const token = hostedUrlFactory.buildToken(HostedResourceEnum.CHECKOUT_SESSION, 'cs_123');

    expect(url).toBe(`https://pay.pinstripe.test/hosted/checkout/cs_123?token=${token}`);
  });

  it('gives the pdf its own path under the same invoice token', () => {
    const hostedUrlFactory = setup();

    const pdfUrl = hostedUrlFactory.buildInvoicePdfUrl('in_123');
    const token = hostedUrlFactory.buildToken(HostedResourceEnum.INVOICE, 'in_123');

    expect(pdfUrl).toBe(`https://pay.pinstripe.test/hosted/invoice/in_123/pdf?token=${token}`);
  });

  it('accepts the token it issued for that resource and id', () => {
    const hostedUrlFactory = setup();
    const token = hostedUrlFactory.buildToken(HostedResourceEnum.INVOICE, 'in_123');

    expect(hostedUrlFactory.verifyToken(HostedResourceEnum.INVOICE, 'in_123', token)).toBe(true);
  });

  it('refuses the token of a different id, a different resource, or a different secret', () => {
    const hostedUrlFactory = setup();
    const token = hostedUrlFactory.buildToken(HostedResourceEnum.INVOICE, 'in_123');
    const otherFactory = setup('another-secret-entirely');

    expect(hostedUrlFactory.verifyToken(HostedResourceEnum.INVOICE, 'in_456', token)).toBe(false);
    expect(hostedUrlFactory.verifyToken(HostedResourceEnum.CHECKOUT_SESSION, 'in_123', token)).toBe(
      false,
    );
    expect(otherFactory.verifyToken(HostedResourceEnum.INVOICE, 'in_123', token)).toBe(false);
  });

  it('refuses a token of the wrong length rather than throwing', () => {
    const hostedUrlFactory = setup();

    expect(hostedUrlFactory.verifyToken(HostedResourceEnum.INVOICE, 'in_123', 'short')).toBe(false);
  });

  it('encodes an id that would otherwise break the path', () => {
    const hostedUrlFactory = setup();

    expect(hostedUrlFactory.buildInvoiceUrl('in/../secret')).toContain('in%2F..%2Fsecret');
  });
});
