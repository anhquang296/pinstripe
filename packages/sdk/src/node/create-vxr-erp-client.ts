import { VxrErpClient } from '@client/vxr-erp.client';
import type { VxrErpConfig } from '@client/vxr-erp.types';

export function createVxrErpClient(overrides: VxrErpConfig = {}): VxrErpClient {
  return new VxrErpClient({ ...readEnvironmentConfig(), ...overrides });
}

function readEnvironmentConfig(): VxrErpConfig {
  const { VXRERP_API_URL, VXRERP_SECRET_API_KEY, VXRERP_MAX_RETRIES, VXRERP_TIMEOUT_MS } =
    process.env;

  return {
    baseUrl: VXRERP_API_URL,
    apiKey: VXRERP_SECRET_API_KEY,
    maxRetries: readInteger(VXRERP_MAX_RETRIES),
    timeoutMs: readInteger(VXRERP_TIMEOUT_MS),
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
