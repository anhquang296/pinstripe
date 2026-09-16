import { createHmac, timingSafeEqual } from 'node:crypto';

import _ from 'lodash';

const SIGNATURE_SCHEME = 'v1';
const MILLISECONDS_PER_SECOND = 1000;

export const WEBHOOK_SIGNATURE_HEADER = 'pinstripe-signature';

export function buildWebhookSignature(payload: string, secret: string, signedAt: Date): string {
  const timestamp = Math.floor(signedAt.getTime() / MILLISECONDS_PER_SECOND);
  const digest = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');

  return `t=${timestamp},${SIGNATURE_SCHEME}=${digest}`;
}

export function isWebhookSignatureValid(payload: string, secret: string, header: string): boolean {
  const parts = _.fromPairs(
    _.map(header.split(','), (part) => {
      const [key, value] = part.split('=');

      return [key ?? '', value ?? ''];
    }),
  );
  const timestamp = parts.t;
  const signature = parts[SIGNATURE_SCHEME];

  if (!timestamp || !signature) {
    return false;
  }

  const expected = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  const signatureBuffer = Buffer.from(signature, 'hex');

  if (expectedBuffer.length !== signatureBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, signatureBuffer);
}
