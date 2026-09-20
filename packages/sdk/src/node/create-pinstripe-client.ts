import { PinstripeClient } from '@client/pinstripe.client';
import type { PinstripeConfig } from '@client/pinstripe.types';

export function createPinstripeClient(overrides: PinstripeConfig = {}): PinstripeClient {
  return new PinstripeClient({ ...readEnvironmentConfig(), ...overrides });
}

function readEnvironmentConfig(): PinstripeConfig {
  const {
    PINSTRIPE_API_URL,
    PINSTRIPE_SECRET_API_KEY,
    PINSTRIPE_MAX_RETRIES,
    PINSTRIPE_TIMEOUT_MS,
  } = process.env;

  return {
    baseUrl: PINSTRIPE_API_URL,
    apiKey: PINSTRIPE_SECRET_API_KEY,
    maxRetries: readInteger(PINSTRIPE_MAX_RETRIES),
    timeoutMs: readInteger(PINSTRIPE_TIMEOUT_MS),
  };
}

function readInteger(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);

  if (Number.isInteger(parsed)) {
    return parsed;
  }

  return undefined;
}
