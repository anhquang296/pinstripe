import { VxrErpSignatureVerificationError } from '@errors/vxr-erp.error';
import { isWebhookSignatureValid } from '@node/webhook-signature';
import { webhooks } from '@node/webhooks.resource';
import { buildWebhookSignature } from '@vxrerp/platform/utils';
import { expect, it } from 'vitest';

const SECRET = 'whsec_test_secret';

function setup(overrides: { body?: string; signedAt?: Date; secret?: string } = {}) {
  const {
    body: rawBody = JSON.stringify({ id: 'evt_1', type: 'invoice.paid' }),
    secret = SECRET,
    signedAt = new Date(),
  } = overrides;

  const signatureHeader = buildWebhookSignature(rawBody, secret, signedAt);

  return { rawBody, signatureHeader };
}

it('accepts a signature produced by the server implementation', () => {
  const { rawBody, signatureHeader } = setup();

  expect(isWebhookSignatureValid(rawBody, signatureHeader, SECRET)).toBe(true);
});

it('rejects a tampered body', () => {
  const { signatureHeader } = setup();

  expect(isWebhookSignatureValid('{"id":"evt_2"}', signatureHeader, SECRET)).toBe(false);
});

it('rejects a signature built with a different secret', () => {
  const { rawBody, signatureHeader } = setup({ secret: 'whsec_other' });

  expect(isWebhookSignatureValid(rawBody, signatureHeader, SECRET)).toBe(false);
});

it('rejects a header missing the v1 scheme', () => {
  const { rawBody } = setup();

  expect(isWebhookSignatureValid(rawBody, 't=1700000000', SECRET)).toBe(false);
});

it('rejects a signature signed outside the tolerance window', () => {
  const { rawBody, signatureHeader } = setup({ signedAt: new Date(Date.now() - 600_000) });

  expect(isWebhookSignatureValid(rawBody, signatureHeader, SECRET)).toBe(false);
});

it('accepts a stale signature when the tolerance is widened', () => {
  const { rawBody, signatureHeader } = setup({ signedAt: new Date(Date.now() - 600_000) });

  expect(isWebhookSignatureValid(rawBody, signatureHeader, SECRET, { toleranceSeconds: 900 })).toBe(
    true,
  );
});

it('constructs the event when the signature is valid', () => {
  const { rawBody, signatureHeader } = setup();

  const event = webhooks.constructEvent(rawBody, signatureHeader, SECRET);

  expect(event.id).toBe('evt_1');
});

it('throws VxrErpSignatureVerificationError when the signature is invalid', () => {
  const { rawBody } = setup();

  expect(() => {
    return webhooks.constructEvent(rawBody, 't=1,v1=deadbeef', SECRET);
  }).toThrow(VxrErpSignatureVerificationError);
});
