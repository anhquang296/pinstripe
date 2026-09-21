import { InternalError, UnauthorizedError } from '@vxrerp/platform/errors';
import { isWebhookSignatureValid, WEBHOOK_SIGNATURE_HEADER } from '@vxrerp/platform/utils';
import type { FastifyReply, FastifyRequest } from 'fastify';
import _ from 'lodash';

export async function verifyPspCallbackRequest(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const { PSP_WEBHOOK_SECRET, PSP_CALLBACK_TOLERANCE_SECONDS } = request.server.billingConfig;

  if (!PSP_WEBHOOK_SECRET) {
    throw new InternalError('PSP callbacks are not accepted until a callback secret is configured');
  }

  const header = _.get(request.headers, WEBHOOK_SIGNATURE_HEADER);
  const signature = _.isString(header) ? header : '';

  const { rawBody } = request;

  if (!signature || !rawBody) {
    throw new UnauthorizedError(`Missing ${WEBHOOK_SIGNATURE_HEADER} header on a PSP callback`);
  }

  const isValid = isWebhookSignatureValid(rawBody, PSP_WEBHOOK_SECRET, signature, {
    toleranceSeconds: PSP_CALLBACK_TOLERANCE_SECONDS,
    verifiedAt: request.server.clock.now(),
  });

  if (isValid) {
    return;
  }

  throw new UnauthorizedError('The PSP callback signature does not match or has expired');
}
