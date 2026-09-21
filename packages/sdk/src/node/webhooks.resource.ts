import { VxrErpSignatureVerificationError } from '@errors/vxr-erp.error';
import type { WebhookVerificationOptions } from '@node/webhook-signature';
import { isWebhookSignatureValid } from '@node/webhook-signature';
import type { VxrErpEvent } from '@type/contracts.types';

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
  ): VxrErpEvent<T> {
    if (isWebhookSignatureValid(rawBody, signatureHeader, secret, options)) {
      return JSON.parse(rawBody) as VxrErpEvent<T>;
    }

    throw new VxrErpSignatureVerificationError(
      'Webhook signature verification failed for the supplied payload',
    );
  },
};
