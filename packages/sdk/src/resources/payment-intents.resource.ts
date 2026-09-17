import type { RequestOptions } from '@client/pinstripe.types';
import { HttpMethodEnum } from '@client/pinstripe.types';
import type { PinstripeTransport } from '@client/pinstripe-transport';
import type {
  CancelPaymentIntentPayload,
  ConfirmPaymentIntentPayload,
  CreatePaymentIntentPayload,
  FindPaymentIntentsQuery,
  ListResponse,
  PaymentIntentResponse,
} from '@type/contracts.types';
import { buildPath } from '@utils/build-path';

const PAYMENT_INTENTS_PATH = '/v1/payment_intents';

export class PaymentIntentsResource {
  private _transport: PinstripeTransport;

  constructor(transport: PinstripeTransport) {
    this._transport = transport;
  }

  find(
    query: FindPaymentIntentsQuery = {},
    options?: RequestOptions,
  ): Promise<ListResponse<PaymentIntentResponse>> {
    return this._transport.request({
      path: PAYMENT_INTENTS_PATH,
      method: HttpMethodEnum.GET,
      query,
      options,
    });
  }

  get(paymentIntentId: string, options?: RequestOptions): Promise<PaymentIntentResponse> {
    return this._transport.request({
      path: buildPath(PAYMENT_INTENTS_PATH, paymentIntentId),
      method: HttpMethodEnum.GET,
      options,
    });
  }

  create(
    payload: CreatePaymentIntentPayload,
    options?: RequestOptions,
  ): Promise<PaymentIntentResponse> {
    return this._transport.request({
      path: PAYMENT_INTENTS_PATH,
      method: HttpMethodEnum.POST,
      payload,
      options,
    });
  }

  confirm(
    paymentIntentId: string,
    payload: ConfirmPaymentIntentPayload = {},
    options?: RequestOptions,
  ): Promise<PaymentIntentResponse> {
    return this._transport.request({
      path: buildPath(PAYMENT_INTENTS_PATH, paymentIntentId, 'confirm'),
      method: HttpMethodEnum.POST,
      payload,
      options,
    });
  }

  cancel(
    paymentIntentId: string,
    payload: CancelPaymentIntentPayload = {},
    options?: RequestOptions,
  ): Promise<PaymentIntentResponse> {
    return this._transport.request({
      path: buildPath(PAYMENT_INTENTS_PATH, paymentIntentId, 'cancel'),
      method: HttpMethodEnum.POST,
      payload,
      options,
    });
  }
}
