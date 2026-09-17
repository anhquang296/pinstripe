import type { PinstripeClient } from '@pinstripe/sdk';
import { createPinstripeClient } from '@pinstripe/sdk/node';

const DEFAULT_API_URL = 'http://localhost:3000';

export const pinstripe: PinstripeClient = createPinstripeClient({
  baseUrl: process.env.PINSTRIPE_API_URL ?? DEFAULT_API_URL,
});
