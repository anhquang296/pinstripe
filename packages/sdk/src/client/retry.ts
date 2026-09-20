import type { HttpMethod } from '@client/pinstripe.types';
import { HttpMethodEnum } from '@client/pinstripe.types';

export const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_BASE_MS = 500;
const DEFAULT_MAX_RETRY_DELAY_MS = 5_000;

export const DEFAULT_TIMEOUT_MS = 30_000;

const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504];
const SAFE_METHODS: HttpMethod[] = [HttpMethodEnum.GET];

export function isRetryableMethod(method: HttpMethod, hasIdempotencyKey: boolean): boolean {
  if (SAFE_METHODS.includes(method)) {
    return true;
  }

  return hasIdempotencyKey;
}

export function isRetryableStatus(statusCode: number): boolean {
  return RETRYABLE_STATUS_CODES.includes(statusCode);
}

export function resolveBackoffMs(attempt: number, retryAfterHeader: string | null): number {
  const retryAfterMs = resolveRetryAfterMs(retryAfterHeader);

  if (retryAfterMs !== null) {
    return Math.min(DEFAULT_MAX_RETRY_DELAY_MS, retryAfterMs);
  }

  const exponentialMs = Math.min(DEFAULT_MAX_RETRY_DELAY_MS, DEFAULT_RETRY_BASE_MS * 2 ** attempt);

  return Math.round(exponentialMs * (0.5 + Math.random() / 2));
}

function resolveRetryAfterMs(retryAfterHeader: string | null): number | null {
  if (!retryAfterHeader) {
    return null;
  }

  const seconds = Number(retryAfterHeader);

  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1_000);
  }

  const retryAt = Date.parse(retryAfterHeader);

  if (Number.isNaN(retryAt)) {
    return null;
  }

  return Math.max(0, retryAt - Date.now());
}
