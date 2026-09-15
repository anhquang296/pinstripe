import { Endpoint, Method, Params, Payload, Request } from '@api/client';

import type {
  ConfirmPaymentIntentPayload,
  CreatePaymentIntentPayload,
  CreateRefundPayload,
  GetPaymentIntentsQuery,
  GetRefundsQuery,
  ListResponse,
  PaymentIntentResponse,
  RefundResponse,
} from './type';

const PAYMENT_INTENTS_PATH = '/v1/payment_intents';
const REFUNDS_PATH = '/v1/refunds';

export function getPaymentIntents(
  query: GetPaymentIntentsQuery = {},
): Promise<ListResponse<PaymentIntentResponse>> {
  return Request<ListResponse<PaymentIntentResponse>>(
    Endpoint(PAYMENT_INTENTS_PATH),
    Method('GET'),
    Params(query),
  );
}

export function createPaymentIntent(
  payload: CreatePaymentIntentPayload,
): Promise<PaymentIntentResponse> {
  return Request<PaymentIntentResponse>(
    Endpoint(PAYMENT_INTENTS_PATH),
    Method('POST'),
    Payload(payload),
  );
}

export function confirmPaymentIntent(
  paymentIntentId: string,
  payload: ConfirmPaymentIntentPayload,
): Promise<PaymentIntentResponse> {
  return Request<PaymentIntentResponse>(
    Endpoint(`${PAYMENT_INTENTS_PATH}/${encodeURIComponent(paymentIntentId)}/confirm`),
    Method('POST'),
    Payload(payload),
  );
}

export function getRefunds(query: GetRefundsQuery = {}): Promise<ListResponse<RefundResponse>> {
  return Request<ListResponse<RefundResponse>>(
    Endpoint(REFUNDS_PATH),
    Method('GET'),
    Params(query),
  );
}

export function createRefund(payload: CreateRefundPayload): Promise<RefundResponse> {
  return Request<RefundResponse>(Endpoint(REFUNDS_PATH), Method('POST'), Payload(payload));
}
