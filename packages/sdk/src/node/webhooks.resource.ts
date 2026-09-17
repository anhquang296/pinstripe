import { PinstripeSignatureVerificationError } from '@errors/pinstripe.error';
import type { WebhookVerificationOptions } from '@node/webhook-signature';
import { isWebhookSignatureValid } from '@node/webhook-signature';
import type { PinstripeEvent } from '@type/contracts.types';

export const webhooks = {
  isSignatureValid(
    rawBody: string,
    signatureHeader: string,
    secret: string,
    options: WebhookVerificationOptions = {},
  ): boolean {
    return isWebhookSignatureValid(rawBody, signatureHeader, secret, options);
  },

  constructEvent<T = unknown>(
    rawBody: string,
    signatureHeader: string,
    secret: string,
    options: WebhookVerificationOptions = {},
  ): PinstripeEvent<T> {
    if (isWebhookSignatureValid(rawBody, signatureHeader, secret, options)) {
      return JSON.parse(rawBody) as PinstripeEvent<T>;
    }

    throw new PinstripeSignatureVerificationError(
      'Webhook signature verification failed for the supplied payload',
    );
  },
};
