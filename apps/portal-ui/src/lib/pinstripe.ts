import type { PinstripeClient } from '@pinstripe/sdk';
import { createPinstripeClient } from '@pinstripe/sdk/node';

const { PINSTRIPE_API_URL = 'http://localhost:3000' } = process.env;

export const pinstripe: PinstripeClient = createPinstripeClient({
  baseUrl: PINSTRIPE_API_URL,
});
