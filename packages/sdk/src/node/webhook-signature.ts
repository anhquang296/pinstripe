import { createHmac, timingSafeEqual } from 'node:crypto';

const SIGNATURE_SCHEME = 'v1';
const MILLISECONDS_PER_SECOND = 1000;

export const WEBHOOK_SIGNATURE_HEADER = 'pinstripe-signature';
export const DEFAULT_WEBHOOK_TOLERANCE_SECONDS = 300;

export interface WebhookVerificationOptions {
  toleranceSeconds?: number;
}

interface SignatureHeader {
  timestamp: string;
  signature: string;
}

export function isWebhookSignatureValid(
  rawBody: string,
  signatureHeader: string,
  secret: string,
  { toleranceSeconds = DEFAULT_WEBHOOK_TOLERANCE_SECONDS }: WebhookVerificationOptions = {},
): boolean {
  const header = parseSignatureHeader(signatureHeader);

  if (!header) {
    return false;
  }

  const { timestamp, signature } = header;

  if (!isWithinTolerance(timestamp, toleranceSeconds)) {
    return false;
  }

  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  const signatureBuffer = Buffer.from(signature, 'hex');

  if (expectedBuffer.length !== signatureBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, signatureBuffer);
}

function parseSignatureHeader(signatureHeader: string): SignatureHeader | null {
  const parts = new Map<string, string>();

  for (const part of signatureHeader.split(',')) {
    const [key, value] = part.split('=');

    if (key && value) {
      parts.set(key.trim(), value);
    }
  }

  const timestamp = parts.get('t');
  const signature = parts.get(SIGNATURE_SCHEME);

  if (timestamp && signature) {
    return { timestamp, signature };
  }

  return null;
}

function isWithinTolerance(timestamp: string, toleranceSeconds: number): boolean {
  const signedAtSeconds = Number(timestamp);

  if (!Number.isFinite(signedAtSeconds)) {
    return false;
  }

  const nowSeconds = Math.floor(Date.now() / MILLISECONDS_PER_SECOND);

  return Math.abs(nowSeconds - signedAtSeconds) <= toleranceSeconds;
}
