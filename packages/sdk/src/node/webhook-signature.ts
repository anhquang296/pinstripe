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
  signatures: string[];
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

  const { timestamp, signatures } = header;

  if (!isWithinTolerance(timestamp, toleranceSeconds)) {
    return false;
  }

  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  const expectedBuffer = Buffer.from(expected, 'hex');

  return signatures.some((signature) => {
    const signatureBuffer = Buffer.from(signature, 'hex');

    if (expectedBuffer.length !== signatureBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, signatureBuffer);
  });
}

function parseSignatureHeader(signatureHeader: string): SignatureHeader | null {
  const signatures: string[] = [];
  let timestamp = '';

  for (const part of signatureHeader.split(',')) {
    const separatorIndex = part.indexOf('=');

    if (separatorIndex > 0) {
      const key = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();

      if (key === 't' && value) {
        timestamp = value;
      }

      if (key === SIGNATURE_SCHEME && value) {
        signatures.push(value);
      }
    }
  }

  if (timestamp && signatures.length > 0) {
    return { timestamp, signatures };
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
