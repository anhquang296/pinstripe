import { buildWebhookSignature, isWebhookSignatureValid } from '@utils/webhook-signature';
import { describe, expect, it } from 'vitest';

const SECRET = 'whsec_test_secret_value';
const PAYLOAD = '{"id":"evt_1","type":"invoice.finalized"}';
const SIGNED_AT = new Date('2026-09-16T00:00:00.000Z');

describe('buildWebhookSignature', () => {
  it('carries the timestamp it signed with so a replay can be spotted', () => {
    const header = buildWebhookSignature(PAYLOAD, SECRET, SIGNED_AT);

    expect(header).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);
  });

  it('produces the same signature for the same payload, secret and moment', () => {
    const first = buildWebhookSignature(PAYLOAD, SECRET, SIGNED_AT);
    const second = buildWebhookSignature(PAYLOAD, SECRET, SIGNED_AT);

    expect(first).toBe(second);
  });
});

describe('isWebhookSignatureValid', () => {
  it('accepts a signature it produced itself', () => {
    const header = buildWebhookSignature(PAYLOAD, SECRET, SIGNED_AT);

    expect(isWebhookSignatureValid(PAYLOAD, SECRET, header)).toBe(true);
  });

  it('rejects a payload that was changed after signing', () => {
    const header = buildWebhookSignature(PAYLOAD, SECRET, SIGNED_AT);

    expect(isWebhookSignatureValid(`${PAYLOAD} `, SECRET, header)).toBe(false);
  });

  it('rejects a signature made with a different secret', () => {
    const header = buildWebhookSignature(PAYLOAD, 'whsec_other_secret_value', SIGNED_AT);

    expect(isWebhookSignatureValid(PAYLOAD, SECRET, header)).toBe(false);
  });

  it('rejects a signature whose timestamp was moved', () => {
    const header = buildWebhookSignature(PAYLOAD, SECRET, SIGNED_AT);
    const tampered = header.replace(/^t=\d+/, 't=1');

    expect(isWebhookSignatureValid(PAYLOAD, SECRET, tampered)).toBe(false);
  });

  it.each([
    { header: '', scenario: 'an empty header' },
    { header: 't=123', scenario: 'a header with no signature' },
    { header: 'v1=abc', scenario: 'a header with no timestamp' },
    { header: 't=123,v1=zz', scenario: 'a signature that is not hex' },
  ])('rejects $scenario', ({ header }) => {
    expect(isWebhookSignatureValid(PAYLOAD, SECRET, header)).toBe(false);
  });
});
